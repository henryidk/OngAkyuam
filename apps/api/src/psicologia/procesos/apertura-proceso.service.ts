import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { etiquetaProcesoPsicologia, parseLocalGT } from '@akyuam/shared';
import type {
  AbrirProcesosPsicologiaInput,
  AtenderAhoraInput,
  CitaResumen,
  ConsultaRegistradaDto,
  PrimeraCitaPersonaInput,
  ProcesosPsicologiaAbiertosDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import { RELOJ, type IReloj } from '../../common/reloj';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import { IdempotenciaPsicologia } from '../compartido/idempotencia';
import { ReservasPsicologia } from '../compartido/reservas';
import {
  camposDelRegistro,
  proximaCitaDelRegistro,
} from '../compartido/registro-sesion';
import { avisarTraslape as avisarTraslapeCita } from '../compartido/traslape';
import {
  CODIGO_TRASLAPE_CITA,
  MENSAJE_APERTURA_EN_CURSO,
  MENSAJE_CASO_YA_TOMADO,
  MENSAJE_OTRO_PROCESO_ACTIVO,
  MENSAJE_PERSONA_AJENA,
  MENSAJE_REFERENCIA_PENDIENTE,
  MENSAJE_SIN_ACCESO_REFERENCIA,
  MENSAJE_SIN_ACCESO_USUARIA,
  MENSAJE_TRASLAPE,
} from '../compartido/mensajes';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import {
  CasoYaTomadoError,
  OtroProcesoActivoError,
  PROCESOS_PSICOLOGIA_REPOSITORY,
  ProcesoNoDisponibleError,
  ReferenciaPendienteError,
} from '../interfaces/procesos-psicologia-repository.interface';
import type {
  IProcesosPsicologiaRepository,
  PrimeraCitaPersona,
  ProcesoAbierto,
} from '../interfaces/procesos-psicologia-repository.interface';
import type { ReferenciaPsicologia } from '../interfaces/bandeja-psicologia-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

/** La usuaria primero: en una referencia es su proceso el que lleva la referencia. */
function usuariaPrimero(
  personas: PrimeraCitaPersonaInput[],
): PrimeraCitaPersonaInput[] {
  return [...personas].sort(
    (a, b) => Number(a.ninoId !== null) - Number(b.ninoId !== null),
  );
}

/** Quiénes se abren, en un orden fijo: la misma selección da siempre la misma clave. */
function firmaPersonas(personas: PrimeraCitaPersonaInput[]): string {
  return personas
    .map((persona) => persona.ninoId ?? 'usuaria')
    .sort()
    .join(',');
}

function aCita(persona: PrimeraCitaPersonaInput): PrimeraCitaPersona {
  return {
    ninoId: persona.ninoId,
    fechaHora: parseLocalGT(persona.fechaHora),
    duracionMinutos: persona.duracionMinutos,
  };
}

@Injectable()
export class AperturaProcesoService {
  constructor(
    @Inject(PROCESOS_PSICOLOGIA_REPOSITORY)
    private readonly procesosRepository: IProcesosPsicologiaRepository,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    private readonly acceso: AccesoPsicologiaService,
    private readonly idempotencia: IdempotenciaPsicologia,
    private readonly reservas: ReservasPsicologia,
    private readonly auditService: AuditService,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  /**
   * "Atender": agenda la primera cita de una referencia sin tomar, para una o varias personas
   * del expediente (la usuaria y/o sus hijos/as), y con eso toma el caso. Cada persona recibe
   * su proceso con su correlativo. Todo o nada: si no se confirma, el caso sigue sin tomar.
   */
  async atender(
    referidoId: string,
    datos: AbrirProcesosPsicologiaInput,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<ProcesosPsicologiaAbiertosDto> {
    const personas = usuariaPrimero(datos.personas);

    const abiertos = await this.unaSolaVez(
      this.idempotencia.clave(
        claveIdempotencia,
        `atender:${referidoId}:${firmaPersonas(personas)}`,
        contexto.usuarioId,
      ),
      async () => {
        const caso = await this.exigirReferenciaLibre(
          referidoId,
          contexto.usuarioId,
        );
        for (const persona of personas) {
          await this.exigirDelExpediente(persona.ninoId, caso.expedienteId);
        }
        await this.avisarTraslape(personas, datos, contexto.usuarioId);
        const abiertos = await this.traducirCarreras(
          MENSAJE_SIN_ACCESO_REFERENCIA,
          () =>
            this.procesosRepository.abrir({
              expedienteId: caso.expedienteId,
              referidoId,
              psicologaId: contexto.usuarioId,
              usuariaId: caso.usuariaId,
              personas: personas.map(aCita),
            }),
        );
        await this.auditarCasoTomado(abiertos[0], caso, contexto);
        return this.concluir(abiertos, caso, 'REFERENCIA', contexto);
      },
    );
    await this.reservas.liberar(referidoId, contexto.usuarioId);
    return abiertos;
  }

  /**
   * "Atender ahora": la persona de una referencia sin tomar llegó sin cita y se atendió. Al
   * registrar la sesión se toma el caso, se abre su proceso con la cita de primera atención
   * (fecha y hora del servidor) y la sesión queda registrada, todo junto: abrir el formulario y
   * salir no toma ni abre nada. Una persona por vez; las demás se abren después desde la ficha.
   */
  async atenderAhora(
    referidoId: string,
    datos: AtenderAhoraInput,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<ConsultaRegistradaDto> {
    const consulta = await this.unaSolaVez(
      this.idempotencia.clave(
        claveIdempotencia,
        `atender-ahora:${referidoId}:${datos.ninoId ?? 'usuaria'}`,
        contexto.usuarioId,
      ),
      async () => {
        const caso = await this.exigirReferenciaLibre(
          referidoId,
          contexto.usuarioId,
        );
        await this.exigirDelExpediente(datos.ninoId, caso.expedienteId);
        // La sesión ocurre ahora, con la persona presente: solo se avisa el traslape de la próxima.
        const siguiente = proximaCitaDelRegistro(datos.registro);
        if (siguiente) {
          await avisarTraslapeCita(this.citasRepository, {
            ...siguiente.cita,
            psicologaId: contexto.usuarioId,
            confirmarTraslape: siguiente.confirmarTraslape,
          });
        }
        const { abierto, registrada } = await this.traducirCarreras(
          MENSAJE_SIN_ACCESO_REFERENCIA,
          () =>
            this.procesosRepository.abrirYRegistrar({
              expedienteId: caso.expedienteId,
              referidoId,
              psicologaId: contexto.usuarioId,
              usuariaId: caso.usuariaId,
              persona: {
                ninoId: datos.ninoId,
                fechaHora: this.reloj.ahora(),
                duracionMinutos: datos.duracionMinutos,
              },
              registro: {
                ...camposDelRegistro(datos.registro),
                proximaCita: siguiente?.cita ?? null,
              },
            }),
        );
        await this.auditarCasoTomado(abierto, caso, contexto);
        await this.concluir([abierto], caso, 'REFERENCIA', contexto);
        // Mismo evento que cualquier registro, sin texto clínico: solo ids y banderas.
        await this.auditService.registrar(
          eventoAuditoria(contexto, {
            accion: 'REGISTRO_CONSULTA_GUARDADO',
            entidad: 'CitaPsicologica',
            entidadId: registrada.cita.id,
            detalles: {
              sinCita: true,
              atenderAhora: true,
              expedienteId: caso.expedienteId,
              procesoId: abierto.procesoId,
              pasoASeguimiento: registrada.pasoASeguimiento,
              proximaCitaId: registrada.proximaCitaId,
            },
          }),
        );
        return {
          cita: registrada.cita,
          procesoId: abierto.procesoId,
          pasoASeguimiento: registrada.pasoASeguimiento,
          proximaCita:
            registrada.proximaCitaId && siguiente
              ? {
                  id: registrada.proximaCitaId,
                  procesoId: abierto.procesoId,
                  fechaHora: siguiente.cita.fechaHora.toISOString(),
                }
              : null,
        };
      },
    );
    await this.reservas.liberar(referidoId, contexto.usuarioId);
    return consulta;
  }

  /**
   * "Abrir proceso" desde la ficha, para una o varias personas: la usuaria (que regresa a un
   * expediente que el área ya tomó) y/o sus hijos/as. Cada una recibe su proceso (P1, P2…) con
   * su primera cita y quien lo abre queda como responsable. Todo o nada: no se abre ninguno si
   * alguna persona tiene un proceso abierto o, si es la usuaria, una referencia pendiente.
   */
  async abrirDesdeFicha(
    usuariaId: string,
    datos: AbrirProcesosPsicologiaInput,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<ProcesosPsicologiaAbiertosDto> {
    await this.acceso.exigirAccesoUsuaria(usuariaId);
    const personas = usuariaPrimero(datos.personas);

    return this.unaSolaVez(
      this.idempotencia.clave(
        claveIdempotencia,
        `abrir:${usuariaId}:${firmaPersonas(personas)}`,
        contexto.usuarioId,
      ),
      async () => {
        const conExpediente: (PrimeraCitaPersona & {
          expedienteId: string;
          expedienteNumero: string;
        })[] = [];
        for (const persona of personas) {
          const destino =
            await this.procesosRepository.buscarExpedienteParaAbrir(
              usuariaId,
              persona.ninoId,
            );
          if (destino === 'PERSONA_AJENA') {
            throw new BadRequestException(MENSAJE_PERSONA_AJENA);
          }
          // Sin un expediente que el área ya tomó, la referencia se atiende primero desde la bandeja.
          if (destino === 'SIN_TOMAR') {
            throw new ConflictException(MENSAJE_REFERENCIA_PENDIENTE);
          }
          await this.exigirDelExpediente(persona.ninoId, destino.id);
          conExpediente.push({
            ...aCita(persona),
            expedienteId: destino.id,
            expedienteNumero: destino.numero,
          });
        }
        await this.avisarTraslape(personas, datos, contexto.usuarioId);
        const abiertos = await this.traducirCarreras(
          MENSAJE_SIN_ACCESO_USUARIA,
          () =>
            this.procesosRepository.abrirNuevo({
              usuariaId,
              psicologaId: contexto.usuarioId,
              personas: conExpediente.map((persona) => ({
                expedienteId: persona.expedienteId,
                ninoId: persona.ninoId,
                fechaHora: persona.fechaHora,
                duracionMinutos: persona.duracionMinutos,
              })),
            }),
        );
        // El expediente de todas es el mismo salvo un caso raro (hijos en otro expediente).
        const numeroDe = new Map(
          conExpediente.map((persona) => [
            persona.ninoId,
            {
              expedienteId: persona.expedienteId,
              expedienteNumero: persona.expedienteNumero,
            },
          ]),
        );
        return this.concluir(
          abiertos,
          (ninoId) => numeroDe.get(ninoId)!,
          'FICHA',
          contexto,
        );
      },
    );
  }

  /**
   * Un doble envío con la misma clave devuelve la primera respuesta; mientras la primera aún se
   * escribe, la segunda recibe un conflicto en vez de abrir otra vez.
   */
  private async unaSolaVez<T>(
    claveRedis: string | null,
    escribir: () => Promise<T>,
  ): Promise<T> {
    const guardada = await this.idempotencia.recuperar<T>(claveRedis);
    if (guardada) {
      return guardada;
    }
    if (!(await this.idempotencia.reservar(claveRedis))) {
      throw new ConflictException(MENSAJE_APERTURA_EN_CURSO);
    }
    try {
      const respuesta =
        (await this.idempotencia.recuperar<T>(claveRedis)) ??
        (await escribir());
      await this.idempotencia.guardar(claveRedis, respuesta);
      return respuesta;
    } finally {
      await this.idempotencia.liberar(claveRedis);
    }
  }

  /**
   * La referencia sigue sin tomar y nadie más la está agendando o atendiendo. La reserva propia
   * no hace falta que siga viva: si venció y nadie más llegó, se guarda igual. La transacción
   * vuelve a comprobar que siga sin tomar, con el expediente bloqueado.
   */
  private async exigirReferenciaLibre(
    referidoId: string,
    usuarioId: string,
  ): Promise<ReferenciaPsicologia> {
    const referencia = await this.acceso.exigirReferenciaSinTomar(referidoId);
    await this.reservas.exigirSinReservaAjena(referidoId, usuarioId);
    return referencia;
  }

  /** "Caso tomado" se audita una vez, cuando de verdad se toma: al confirmar la primera cita. */
  private async auditarCasoTomado(
    primero: ProcesoAbierto,
    caso: ReferenciaPsicologia,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'CASO_PSICOLOGIA_TOMADO',
        entidad: 'AtencionPsicologica',
        entidadId: primero.procesoId,
        detalles: {
          expedienteId: caso.expedienteId,
          referidoId: caso.referidoId,
        },
      }),
    );
  }

  private async exigirDelExpediente(
    ninoId: string | null,
    expedienteId: string,
  ): Promise<void> {
    if (
      ninoId !== null &&
      !(await this.procesosRepository.ninoPerteneceAExpediente(
        ninoId,
        expedienteId,
      ))
    ) {
      throw new BadRequestException(MENSAJE_PERSONA_AJENA);
    }
  }

  /** El traslape con la propia agenda avisa una vez, por todas las citas, y se puede confirmar. */
  private async avisarTraslape(
    personas: PrimeraCitaPersonaInput[],
    datos: AbrirProcesosPsicologiaInput,
    psicologaId: string,
  ): Promise<void> {
    if (datos.confirmarTraslape) {
      return;
    }
    const solapadas = new Map<string, CitaResumen>();
    for (const persona of personas) {
      const encontradas = await this.citasRepository.buscarCitasSolapadas({
        psicologaId,
        fechaHora: parseLocalGT(persona.fechaHora),
        duracionMinutos: persona.duracionMinutos,
      });
      for (const cita of encontradas) {
        solapadas.set(cita.id, cita);
      }
    }
    if (solapadas.size > 0) {
      throw new ConflictException({
        message: MENSAJE_TRASLAPE,
        codigo: CODIGO_TRASLAPE_CITA,
        detalle: { citas: [...solapadas.values()] },
      });
    }
  }

  /** Audita cada proceso (solo ids) y arma la respuesta con sus códigos. */
  private async concluir(
    abiertos: ProcesoAbierto[],
    expediente:
      | { expedienteId: string; expedienteNumero: string }
      | ((ninoId: string | null) => {
          expedienteId: string;
          expedienteNumero: string;
        }),
    origen: 'REFERENCIA' | 'FICHA',
    contexto: ContextoAuditoria,
  ): Promise<ProcesosPsicologiaAbiertosDto> {
    const procesos: ProcesosPsicologiaAbiertosDto['procesos'] = [];
    for (const abierto of abiertos) {
      const delProceso =
        typeof expediente === 'function'
          ? expediente(abierto.ninoId)
          : expediente;
      await this.auditService.registrar(
        eventoAuditoria(contexto, {
          accion: 'PROCESO_PSICOLOGICO_ABIERTO',
          entidad: 'AtencionPsicologica',
          entidadId: abierto.procesoId,
          detalles: {
            expedienteId: delProceso.expedienteId,
            procesoId: abierto.procesoId,
            citaId: abierto.citaId,
            ninoId: abierto.ninoId,
            origen,
          },
        }),
      );
      procesos.push({
        procesoId: abierto.procesoId,
        codigo: etiquetaProcesoPsicologia(
          delProceso.expedienteNumero,
          abierto.consecutivo,
          abierto.ninoConsecutivo,
        ),
        ninoId: abierto.ninoId,
        citaId: abierto.citaId,
      });
    }
    return { procesos };
  }

  /** Traduce a HTTP las carreras que solo se detectan dentro de la transacción. */
  private async traducirCarreras<T>(
    mensajeSinAcceso: string,
    abrir: () => Promise<T>,
  ): Promise<T> {
    try {
      return await abrir();
    } catch (error) {
      if (error instanceof ProcesoNoDisponibleError) {
        throw new ForbiddenException(mensajeSinAcceso);
      }
      if (error instanceof CasoYaTomadoError) {
        throw new ConflictException(MENSAJE_CASO_YA_TOMADO);
      }
      if (error instanceof OtroProcesoActivoError) {
        throw new ConflictException(MENSAJE_OTRO_PROCESO_ACTIVO);
      }
      if (error instanceof ReferenciaPendienteError) {
        throw new ConflictException(MENSAJE_REFERENCIA_PENDIENTE);
      }
      throw error;
    }
  }
}
