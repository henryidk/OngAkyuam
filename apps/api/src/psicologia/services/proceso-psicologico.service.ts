import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ActualizarEstadoAtencionInput,
  AtencionPsicologicaDetalle,
  BuscarExpedientesQuery,
  ExpedienteResumenPsicologia,
  ExpedientesPaginados,
  ReferenciaSinTomar,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ATENCION_PSICOLOGICA_REPOSITORY } from '../interfaces/atencion-psicologica-repository.interface';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import { AccesoPsicologiaService } from './acceso-psicologia.service';

/** Tamaño de página fijo para los listados por cursor de psicología (§7.3/§7.5 del plan). */
const LIMITE_PAGINA = 20;

const MENSAJE_CASO_YA_TOMADO = 'Este caso ya fue tomado por otra profesional';

/** "" (campo opcional sin llenar) -> null para la base de datos, mismo criterio que juridico.service.ts. */
function vacioANulo(valor: string): string | null {
  return valor === '' ? null : valor;
}

@Injectable()
export class ProcesoPsicologicoService {
  constructor(
    private readonly acceso: AccesoPsicologiaService,
    @Inject(ATENCION_PSICOLOGICA_REPOSITORY)
    private readonly atencionRepository: IAtencionPsicologicaRepository,
    private readonly auditService: AuditService,
  ) {}

  async obtenerAtencion(
    expedienteId: string,
    contexto: ContextoAuditoria,
  ): Promise<AtencionPsicologicaDetalle> {
    await this.acceso.exigirAccesoExpediente(expedienteId, contexto.usuarioId);

    const atencion = await this.atencionRepository.obtenerOCrear({
      expedienteId,
      creadaPorId: contexto.usuarioId,
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'ATENCION_PSICOLOGICA_CONSULTADA',
      entidad: 'AtencionPsicologica',
      entidadId: atencion.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId },
    });

    return atencion;
  }

  async actualizarEstadoAtencion(
    expedienteId: string,
    datos: ActualizarEstadoAtencionInput,
    contexto: ContextoAuditoria,
  ): Promise<AtencionPsicologicaDetalle> {
    await this.acceso.exigirAccesoExpediente(expedienteId, contexto.usuarioId);

    // La atención ya existe siempre que el guard de arriba pase (solo se asigna dueña al
    // tomar el caso, y tomar el caso ya la crea) — se usa `obtenerOCrear` solo por simetría
    // con el resto del servicio, nunca crea nada nuevo en este punto.
    const actual = await this.atencionRepository.obtenerOCrear({
      expedienteId,
      creadaPorId: contexto.usuarioId,
    });
    if (actual.estado === datos.estado) {
      throw new BadRequestException(
        'El expediente ya se encuentra en ese estado',
      );
    }

    const atencion = await this.atencionRepository.actualizarEstado({
      expedienteId,
      estado: datos.estado,
      motivo: vacioANulo(datos.motivo),
      actualizadoPorId: contexto.usuarioId,
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'ATENCION_PSICOLOGICA_ESTADO_ACTUALIZADO',
      entidad: 'AtencionPsicologica',
      entidadId: atencion.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId, estado: datos.estado },
    });

    return atencion;
  }

  /**
   * Reclamo de caso (§7.4 del plan): la primera psicóloga en tomarlo se vuelve su única dueña.
   * `existeReferidoPsicologia` (no `exigirAccesoExpediente`) es el guard correcto aquí — exigir
   * ya tener acceso sería circular, ya que tomar el caso es precisamente lo que lo otorga.
   */
  async tomarCaso(
    expedienteId: string,
    contexto: ContextoAuditoria,
  ): Promise<AtencionPsicologicaDetalle> {
    await this.acceso.exigirReferidoPsicologia(expedienteId);

    const resultado = await this.atencionRepository.tomarCaso({
      expedienteId,
      psicologaId: contexto.usuarioId,
    });
    if (resultado === 'YA_TOMADO') {
      throw new ConflictException(MENSAJE_CASO_YA_TOMADO);
    }

    const atencion = await this.atencionRepository.obtenerOCrear({
      expedienteId,
      creadaPorId: contexto.usuarioId,
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'ATENCION_PSICOLOGICA_TOMADA',
      entidad: 'AtencionPsicologica',
      entidadId: atencion.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId },
    });

    return atencion;
  }

  /** Cola de trabajo del área — visible para todas las psicólogas, sin restricción de dueña. */
  listarReferenciasSinTomar(): Promise<ReferenciaSinTomar[]> {
    return this.atencionRepository.listarReferenciasSinTomar();
  }

  /** Búsqueda paginada por cursor, siempre acotada a los casos tomados por esta psicóloga (§7.3 del plan). */
  buscarExpedientes(
    query: BuscarExpedientesQuery,
    psicologaId: string,
  ): Promise<ExpedientesPaginados> {
    return this.atencionRepository.buscarExpedientes({
      psicologaId,
      q: query.q,
      estado: query.estado,
      municipio: query.municipio,
      cursor: query.cursor,
      limite: LIMITE_PAGINA,
    });
  }

  /** Cabecera de un caso puntual para la tab "Resumen del proceso" (§5.3 del plan). */
  async obtenerResumenExpediente(
    expedienteId: string,
    psicologaId: string,
  ): Promise<ExpedienteResumenPsicologia> {
    await this.acceso.exigirAccesoExpediente(expedienteId, psicologaId);

    const resumen =
      await this.atencionRepository.obtenerResumenExpediente(expedienteId);
    if (!resumen) {
      throw new NotFoundException('Expediente no encontrado');
    }
    return resumen;
  }
}
