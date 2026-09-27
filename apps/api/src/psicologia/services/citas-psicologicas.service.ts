import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ESTADOS_CITA_PSICOLOGICA,
  fechaCalendarioGT,
  finDiaGT,
  finMesGT,
  inicioDiaGT,
  inicioMesGT,
  parseLocalGT,
  type AgendaCita,
  type AgendaResumenDia,
  type AgendaResumenQuery,
  type CitaPsicologicaDetalle,
  type CitaResumen,
  type CitasPaginadas,
  type EstadoCitaPsicologica,
  type HistorialCitasQuery,
  type ProgramarCitaInput,
  type RangoFechasQuery,
  type ReprogramarCitaInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import { ATENCION_PSICOLOGICA_REPOSITORY } from '../interfaces/atencion-psicologica-repository.interface';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { AccesoPsicologiaService } from './acceso-psicologia.service';

interface ContextoAuditoria {
  usuarioId: string;
  username: string;
  ipAddress?: string;
  userAgent?: string;
}

/** "" (campo opcional sin llenar) -> null para la base de datos, mismo criterio que juridico.service.ts. */
function vacioANulo(valor: string): string | null {
  return valor === '' ? null : valor;
}

const MENSAJE_TRASLAPE = 'Ya existe una cita programada en ese horario';

/** Tamaño de página fijo para los listados por cursor de psicología (§7.3/§7.5 del plan). */
const LIMITE_PAGINA = 20;

@Injectable()
export class CitasPsicologicasService {
  constructor(
    private readonly acceso: AccesoPsicologiaService,
    @Inject(ATENCION_PSICOLOGICA_REPOSITORY)
    private readonly atencionRepository: IAtencionPsicologicaRepository,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    private readonly auditService: AuditService,
  ) {}

  async programarCita(
    expedienteId: string,
    datos: ProgramarCitaInput,
    contexto: ContextoAuditoria,
  ): Promise<CitaResumen> {
    await this.acceso.exigirAccesoExpediente(expedienteId, contexto.usuarioId);

    const fechaHora = parseLocalGT(datos.fechaHora);
    const solapadas = await this.citasRepository.buscarCitasSolapadas({
      psicologaId: contexto.usuarioId,
      fechaHora,
      duracionMinutos: datos.duracionMinutos,
    });
    if (solapadas.length > 0 && !datos.confirmarTraslape) {
      throw new ConflictException({
        mensaje: MENSAJE_TRASLAPE,
        citasEnConflicto: solapadas,
      });
    }

    // Creación perezosa: si esta es la primera cita del expediente, la atención (estado
    // INICIO) todavía no existe — se asegura antes de colgar la cita de ella.
    const atencion = await this.atencionRepository.obtenerOCrear({
      expedienteId,
      creadaPorId: contexto.usuarioId,
    });

    const cita = await this.citasRepository.crear({
      atencionId: atencion.id,
      fechaHora,
      modalidad: datos.modalidad,
      lugar: vacioANulo(datos.lugar),
      motivo: datos.motivo,
      tipo: datos.tipo,
      duracionMinutos: datos.duracionMinutos,
      atendidoPorId: contexto.usuarioId,
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'CITA_PSICOLOGICA_PROGRAMADA',
      entidad: 'CitaPsicologica',
      entidadId: cita.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId, modalidad: datos.modalidad },
    });

    return cita;
  }

  /** Siempre "mi" agenda — sin rol de coordinación en este alcance (§12 del plan). */
  async listarAgenda(
    query: RangoFechasQuery,
    psicologaId: string,
  ): Promise<AgendaCita[]> {
    return this.citasRepository.listarAgenda({
      desde: inicioDiaGT(query.desde),
      hasta: finDiaGT(query.hasta),
      psicologaId,
    });
  }

  /** Crea la cita nueva y marca la anterior REPROGRAMADA en una sola transacción (§7.5 del plan). */
  async reprogramarCita(
    citaId: string,
    datos: ReprogramarCitaInput,
    contexto: ContextoAuditoria,
  ): Promise<CitaResumen> {
    await this.acceso.exigirAccesoCita(citaId, contexto.usuarioId);

    const origen =
      await this.citasRepository.obtenerDatosParaReprogramar(citaId);
    if (!origen) {
      throw new NotFoundException('Cita no encontrada');
    }
    if (origen.estado !== 'PROGRAMADA') {
      throw new BadRequestException(
        'Solo se puede reprogramar una cita que esté programada',
      );
    }

    const fechaHora = parseLocalGT(datos.fechaHora);
    const solapadas = await this.citasRepository.buscarCitasSolapadas({
      psicologaId: contexto.usuarioId,
      fechaHora,
      duracionMinutos: origen.duracionMinutos,
      excluirCitaId: citaId,
    });
    if (solapadas.length > 0 && !datos.confirmarTraslape) {
      throw new ConflictException({
        mensaje: MENSAJE_TRASLAPE,
        citasEnConflicto: solapadas,
      });
    }

    const cita = await this.citasRepository.reprogramar({
      citaAnteriorId: citaId,
      atencionId: origen.atencionId,
      tipo: origen.tipo,
      duracionMinutos: origen.duracionMinutos,
      fechaHora,
      modalidad: datos.modalidad,
      lugar: vacioANulo(datos.lugar),
      motivo: datos.motivo,
      atendidoPorId: contexto.usuarioId,
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'CITA_PSICOLOGICA_REPROGRAMADA',
      entidad: 'CitaPsicologica',
      entidadId: cita.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { citaAnteriorId: citaId },
    });

    return cita;
  }

  /** Siempre "mi" resumen mensual — mismo criterio de dueña que el resto del módulo (§5.2/§7.5 del plan). */
  async obtenerResumenAgenda(
    query: AgendaResumenQuery,
    psicologaId: string,
  ): Promise<AgendaResumenDia[]> {
    const citas = await this.citasRepository.listarCitasEnRango({
      psicologaId,
      desde: inicioMesGT(query.anio, query.mes),
      hasta: finMesGT(query.anio, query.mes),
    });

    const porDia = new Map<string, AgendaResumenDia>();
    for (const cita of citas) {
      const fecha = fechaCalendarioGT(cita.fechaHora);
      let dia = porDia.get(fecha);
      if (!dia) {
        dia = {
          fecha,
          totalCitas: 0,
          porEstado: Object.fromEntries(
            ESTADOS_CITA_PSICOLOGICA.map((estado) => [estado, 0]),
          ) as Record<EstadoCitaPsicologica, number>,
        };
        porDia.set(fecha, dia);
      }
      dia.totalCitas += 1;
      dia.porEstado[cita.estado] += 1;
    }

    return Array.from(porDia.values()).sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );
  }

  /** Historial paginado por cursor de las citas de un expediente puntual (§5.3 del plan). */
  async listarHistorialCitas(
    expedienteId: string,
    query: HistorialCitasQuery,
    psicologaId: string,
  ): Promise<CitasPaginadas> {
    await this.acceso.exigirAccesoExpediente(expedienteId, psicologaId);

    const atencion = await this.atencionRepository.obtenerOCrear({
      expedienteId,
      creadaPorId: psicologaId,
    });

    return this.citasRepository.listarHistorial({
      atencionId: atencion.id,
      estado: query.estado,
      cursor: query.cursor,
      limite: LIMITE_PAGINA,
    });
  }

  /** Permalink de una cita puntual — `GET /psicologia/citas/:id`. */
  async obtenerDetalleCita(
    citaId: string,
    psicologaId: string,
  ): Promise<CitaPsicologicaDetalle> {
    await this.acceso.exigirAccesoCita(citaId, psicologaId);

    const cita = await this.citasRepository.obtenerDetalle(citaId);
    if (!cita) {
      throw new NotFoundException('Cita no encontrada');
    }
    return cita;
  }
}
