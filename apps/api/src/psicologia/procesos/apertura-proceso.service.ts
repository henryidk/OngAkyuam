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
import {
  camposDelRegistro,
  proximaCitaDelRegistro,
} from '../compartido/registro-sesion';
import { avisarTraslape as avisarTraslapeCita } from '../compartido/traslape';
import {
  CODIGO_TRASLAPE_CITA,
  MENSAJE_APERTURA_EN_CURSO,
  MENSAJE_OTRO_PROCESO_ACTIVO,
  MENSAJE_PERSONA_AJENA,
  MENSAJE_PROCESO_YA_ABIERTO,
  MENSAJE_REFERENCIA_PENDIENTE,
  MENSAJE_SIN_ACCESO_REFERENCIA,
  MENSAJE_SIN_ACCESO_USUARIA,
  MENSAJE_TRASLAPE,
} from '../compartido/mensajes';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import {
  OtroProcesoActivoError,
  PROCESOS_PSICOLOGIA_REPOSITORY,
  ProcesoNoDisponibleError,
  ProcesoYaAbiertoError,
  ReferenciaPendienteError,
} from '../interfaces/procesos-psicologia-repository.interface';
import type {
  IProcesosPsicologiaRepository,
  PrimeraCitaPersona,
  ProcesoAbierto,
} from '../interfaces/procesos-psicologia-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

/** La usuaria primero: en una referencia es la que ocupa el proceso del caso tomado. */
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
    private readonly auditService: AuditService,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  /**
   * "Atender": agenda la primera cita de un caso ya tomado, para una o varias personas del
   * expediente (la usuaria y/o sus hijos/as). La primera ocupa el proceso del caso, que recibe su
   * fecha de inicio y deja de estar "por agendar"; cada una de las demás recibe su propio
   * proceso en el mismo expediente, con su correlativo. Todo o nada.
   */
  async atender(
    referidoId: string,
    datos: AbrirProcesosPsicologiaInput,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<ProcesosPsicologiaAbiertosDto> {
    const caso = await this.acceso.exigirCasoTomado(
      referidoId,
      contexto.usuarioId,
    );
    const personas = usuariaPrimero(datos.personas);

    return this.unaSolaVez(
      this.idempotencia.clave(
        claveIdempotencia,
        `atender:${referidoId}:${firmaPersonas(personas)}`,
        contexto.usuarioId,
      ),
      async () => {
        for (const persona of personas) {
          await this.exigirDelExpediente(persona.ninoId, caso.expedienteId);
        }
        await this.avisarTraslape(personas, datos, contexto.usuarioId);
        const abiertos = await this.traducirCarreras(
          MENSAJE_SIN_ACCESO_REFERENCIA,
          () =>
            this.procesosRepository.abrir({
              procesoId: caso.procesoId,
              psicologaId: contexto.usuarioId,
              usuariaId: caso.usuariaId,
              personas: personas.map(aCita),
            }),
        );
        return this.concluir(abiertos, caso, 'REFERENCIA', contexto);
      },
    );
  }

  /**
   * "Atender ahora": la persona de un caso ya tomado llegó sin primera cita agendada y se
   * atendió. Al registrar la sesión se abre su proceso con la cita de primera atención (fecha y
   * hora del servidor) y la sesión queda registrada, todo junto: abrir el formulario y salir no
   * abre nada. Una persona por vez; las demás se abren después, desde la Agenda o la ficha.
   */
  async atenderAhora(
    referidoId: string,
    datos: AtenderAhoraInput,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<ConsultaRegistradaDto> {
    const caso = await this.acceso.exigirCasoTomado(
      referidoId,
      contexto.usuarioId,
    );

    return this.unaSolaVez(
      this.idempotencia.clave(
        claveIdempotencia,
        `atender-ahora:${referidoId}:${datos.ninoId ?? 'usuaria'}`,
        contexto.usuarioId,
      ),
      async () => {
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
              procesoId: caso.procesoId,
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
      if (error instanceof ProcesoYaAbiertoError) {
        throw new ConflictException(MENSAJE_PROCESO_YA_ABIERTO);
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
