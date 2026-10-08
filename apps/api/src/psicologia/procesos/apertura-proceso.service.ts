import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { parseLocalGT } from '@akyuam/shared';
import type {
  AgendarCitaPsicologicaInput,
  ProcesoPsicologiaAbiertoDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { RedisService } from '../../redis/redis.service';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_OTRO_PROCESO_ACTIVO,
  MENSAJE_PERSONA_AJENA,
  MENSAJE_PROCESO_YA_ABIERTO,
  MENSAJE_SIN_ACCESO_REFERENCIA,
  MENSAJE_TRASLAPE,
} from '../compartido/mensajes';
import { codigoProceso } from '../dominio/codigo-proceso';
import { motivoFueraDeHorario } from '../dominio/horario-cita';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import {
  OtroProcesoActivoError,
  PROCESOS_PSICOLOGIA_REPOSITORY,
  ProcesoNoDisponibleError,
  ProcesoYaAbiertoError,
} from '../interfaces/procesos-psicologia-repository.interface';
import type {
  AbrirProcesoParams,
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
   * (recibe su fecha de inicio) y deja de estar "por agendar".
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
      contexto.usuarioId,
      referidoId,
    );
    if (claveRedis) {
      const guardada = await this.redisService.get(claveRedis);
      if (guardada) {
        return JSON.parse(guardada) as ProcesoPsicologiaAbiertoDto;
      }
    }

    const fechaHora = parseLocalGT(datos.fechaHora);
    const fueraDeHorario = motivoFueraDeHorario(
      fechaHora,
      datos.duracionMinutos,
    );
    if (fueraDeHorario) {
      throw new BadRequestException(fueraDeHorario);
    }
    if (
      datos.ninoId !== null &&
      !(await this.procesosRepository.ninoPerteneceAExpediente(
        datos.ninoId,
        caso.expedienteId,
      ))
    ) {
      throw new BadRequestException(MENSAJE_PERSONA_AJENA);
    }
    if (!datos.confirmarTraslape) {
      const solapadas = await this.citasRepository.buscarCitasSolapadas({
        psicologaId: contexto.usuarioId,
        fechaHora,
        duracionMinutos: datos.duracionMinutos,
      });
      if (solapadas.length > 0) {
        throw new ConflictException({
          mensaje: MENSAJE_TRASLAPE,
          citasEnConflicto: solapadas,
        });
      }
    }

    const abierto = await this.abrir({
      procesoId: caso.procesoId,
      psicologaId: contexto.usuarioId,
      usuariaId: caso.usuariaId,
      fechaHora,
      duracionMinutos: datos.duracionMinutos,
      ninoId: datos.ninoId,
    });

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'PROCESO_PSICOLOGICO_ABIERTO',
        entidad: 'AtencionPsicologica',
        entidadId: abierto.procesoId,
        detalles: {
          expedienteId: caso.expedienteId,
          procesoId: abierto.procesoId,
          citaId: abierto.citaId,
        },
      }),
    );

    const respuesta: ProcesoPsicologiaAbiertoDto = {
      procesoId: abierto.procesoId,
      codigo: codigoProceso(abierto.consecutivo, caso.expedienteNumero),
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

  /** Traduce a HTTP las carreras que solo se detectan dentro de la transacción. */
  private async abrir(params: AbrirProcesoParams): Promise<ProcesoAbierto> {
    try {
      return await this.procesosRepository.abrir(params);
    } catch (error) {
      if (error instanceof ProcesoNoDisponibleError) {
        throw new ForbiddenException(MENSAJE_SIN_ACCESO_REFERENCIA);
      }
      if (error instanceof ProcesoYaAbiertoError) {
        throw new ConflictException(MENSAJE_PROCESO_YA_ABIERTO);
      }
      if (error instanceof OtroProcesoActivoError) {
        throw new ConflictException(MENSAJE_OTRO_PROCESO_ACTIVO);
      }
      throw error;
    }
  }

  /** La clave es de quien la envió y de esa referencia: no sirve para leer respuestas ajenas. */
  private claveIdempotencia(
    clave: string | undefined,
    usuarioId: string,
    referidoId: string,
  ): string | null {
    if (clave === undefined) {
      return null;
    }
    if (!FORMATO_CLAVE_IDEMPOTENCIA.test(clave)) {
      throw new BadRequestException('Idempotency-Key inválida');
    }
    return `psicologia:atender:${usuarioId}:${referidoId}:${clave}`;
  }
}
