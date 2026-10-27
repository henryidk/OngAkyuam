import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { etiquetaProcesoPsicologia, parseLocalGT } from '@akyuam/shared';
import type {
  AgendarCitaPsicologicaInput,
  ProcesoPsicologiaAbiertoDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { RedisService } from '../../redis/redis.service';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  CODIGO_TRASLAPE_CITA,
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
  ProcesoAbierto,
} from '../interfaces/procesos-psicologia-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

/** Cuánto se recuerda la respuesta para no abrir el proceso dos veces por un doble envío. */
const TTL_IDEMPOTENCIA_SEGUNDOS = 600;
const FORMATO_CLAVE_IDEMPOTENCIA = /^[A-Za-z0-9-]{8,64}$/;

@Injectable()
export class AperturaProcesoService {
  constructor(
    @Inject(PROCESOS_PSICOLOGIA_REPOSITORY)
    private readonly procesosRepository: IProcesosPsicologiaRepository,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    private readonly acceso: AccesoPsicologiaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * "Atender": agenda la primera cita de un caso ya tomado. Con eso el proceso queda abierto
   * (recibe su fecha de inicio), es de la persona elegida (la usuaria o un hijo/a) y deja de
   * estar "por agendar". Las demás personas se abren después desde la ficha.
   */
  async atender(
    referidoId: string,
    datos: AgendarCitaPsicologicaInput,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<ProcesoPsicologiaAbiertoDto> {
    const caso = await this.acceso.exigirCasoTomado(
      referidoId,
      contexto.usuarioId,
    );

    const claveRedis = this.claveIdempotencia(
      claveIdempotencia,
      `atender:${contexto.usuarioId}:${referidoId}`,
    );
    const guardada = await this.respuestaGuardada(claveRedis);
    if (guardada) {
      return guardada;
    }

    const fechaHora = await this.validarPrimeraCita(
      datos,
      caso.expedienteId,
      contexto.usuarioId,
    );
    const abierto = await this.traducirCarreras(
      MENSAJE_SIN_ACCESO_REFERENCIA,
      () =>
        this.procesosRepository.abrir({
          procesoId: caso.procesoId,
          psicologaId: contexto.usuarioId,
          usuariaId: caso.usuariaId,
          fechaHora,
          duracionMinutos: datos.duracionMinutos,
          ninoId: datos.ninoId,
        }),
    );

    return this.concluir(
      abierto,
      datos.ninoId,
      caso,
      'REFERENCIA',
      contexto,
      claveRedis,
    );
  }

  /**
   * "Abrir proceso" desde la ficha, para una persona: la usuaria (que regresa a un expediente
   * que el área ya tomó) o uno de sus hijos/as. Nace su proceso (P1, P2…) con su primera cita
   * y quien lo abre queda como responsable. No se permite si esa persona tiene un proceso
   * abierto o, si es la usuaria, una referencia pendiente.
   */
  async abrirDesdeFicha(
    usuariaId: string,
    datos: AgendarCitaPsicologicaInput,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<ProcesoPsicologiaAbiertoDto> {
    await this.acceso.exigirAccesoUsuaria(usuariaId);

    const claveRedis = this.claveIdempotencia(
      claveIdempotencia,
      `abrir:${contexto.usuarioId}:${usuariaId}:${datos.ninoId ?? 'usuaria'}`,
    );
    const guardada = await this.respuestaGuardada(claveRedis);
    if (guardada) {
      return guardada;
    }

    const destino = await this.procesosRepository.buscarExpedienteParaAbrir(
      usuariaId,
      datos.ninoId,
    );
    if (destino === 'PERSONA_AJENA') {
      throw new BadRequestException(MENSAJE_PERSONA_AJENA);
    }
    // Sin un expediente que el área ya tomó, la referencia se atiende primero desde la bandeja.
    if (destino === 'SIN_TOMAR') {
      throw new ConflictException(MENSAJE_REFERENCIA_PENDIENTE);
    }
    const expediente = {
      expedienteId: destino.id,
      expedienteNumero: destino.numero,
    };

    const fechaHora = await this.validarPrimeraCita(
      datos,
      expediente.expedienteId,
      contexto.usuarioId,
    );
    const abierto = await this.traducirCarreras(
      MENSAJE_SIN_ACCESO_USUARIA,
      () =>
        this.procesosRepository.abrirNuevo({
          expedienteId: expediente.expedienteId,
          usuariaId,
          psicologaId: contexto.usuarioId,
          fechaHora,
          duracionMinutos: datos.duracionMinutos,
          ninoId: datos.ninoId,
        }),
    );

    return this.concluir(
      abierto,
      datos.ninoId,
      expediente,
      'FICHA',
      contexto,
      claveRedis,
    );
  }

  /** La persona debe ser del expediente; el traslape avisa una vez y se puede confirmar. */
  private async validarPrimeraCita(
    datos: AgendarCitaPsicologicaInput,
    expedienteId: string,
    psicologaId: string,
  ): Promise<Date> {
    const fechaHora = parseLocalGT(datos.fechaHora);
    if (
      datos.ninoId !== null &&
      !(await this.procesosRepository.ninoPerteneceAExpediente(
        datos.ninoId,
        expedienteId,
      ))
    ) {
      throw new BadRequestException(MENSAJE_PERSONA_AJENA);
    }
    if (!datos.confirmarTraslape) {
      const solapadas = await this.citasRepository.buscarCitasSolapadas({
        psicologaId,
        fechaHora,
        duracionMinutos: datos.duracionMinutos,
      });
      if (solapadas.length > 0) {
        throw new ConflictException({
          message: MENSAJE_TRASLAPE,
          codigo: CODIGO_TRASLAPE_CITA,
          detalle: { citas: solapadas },
        });
      }
    }
    return fechaHora;
  }

  private async concluir(
    abierto: ProcesoAbierto,
    ninoId: string | null,
    expediente: { expedienteId: string; expedienteNumero: string },
    origen: 'REFERENCIA' | 'FICHA',
    contexto: ContextoAuditoria,
    claveRedis: string | null,
  ): Promise<ProcesoPsicologiaAbiertoDto> {
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'PROCESO_PSICOLOGICO_ABIERTO',
        entidad: 'AtencionPsicologica',
        entidadId: abierto.procesoId,
        detalles: {
          expedienteId: expediente.expedienteId,
          procesoId: abierto.procesoId,
          citaId: abierto.citaId,
          ninoId,
          origen,
        },
      }),
    );

    const respuesta: ProcesoPsicologiaAbiertoDto = {
      procesoId: abierto.procesoId,
      codigo: etiquetaProcesoPsicologia(
        expediente.expedienteNumero,
        abierto.consecutivo,
        abierto.ninoConsecutivo,
      ),
      citaId: abierto.citaId,
    };
    if (claveRedis) {
      await this.redisService.set(
        claveRedis,
        JSON.stringify(respuesta),
        TTL_IDEMPOTENCIA_SEGUNDOS,
      );
    }
    return respuesta;
  }

  private async respuestaGuardada(
    claveRedis: string | null,
  ): Promise<ProcesoPsicologiaAbiertoDto | null> {
    if (!claveRedis) {
      return null;
    }
    const guardada = await this.redisService.get(claveRedis);
    return guardada
      ? (JSON.parse(guardada) as ProcesoPsicologiaAbiertoDto)
      : null;
  }

  /** Traduce a HTTP las carreras que solo se detectan dentro de la transacción. */
  private async traducirCarreras(
    mensajeSinAcceso: string,
    abrir: () => Promise<ProcesoAbierto>,
  ): Promise<ProcesoAbierto> {
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

  /** La clave es de quien la envió y de ese caso o usuaria: no sirve para leer respuestas ajenas. */
  private claveIdempotencia(
    clave: string | undefined,
    ambito: string,
  ): string | null {
    if (clave === undefined) {
      return null;
    }
    if (!FORMATO_CLAVE_IDEMPOTENCIA.test(clave)) {
      throw new BadRequestException('Idempotency-Key inválida');
    }
    return `psicologia:${ambito}:${clave}`;
  }
}
