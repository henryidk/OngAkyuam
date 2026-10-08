import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  diaSemanaGT,
  finDiaGT,
  hoyGT,
  inicioDiaGT,
  minutosDelDiaGT,
  sumarDiasGT,
} from '@akyuam/shared';
import type {
  CitaAgendaDto,
  HuecoLibreDto,
  HuecosAgendaQuery,
  RangoFechasQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_CITA_NO_MARCABLE,
  MENSAJE_RANGO_AGENDA_INVALIDO,
} from '../compartido/mensajes';
import { huecosLibres } from '../dominio/huecos-libres';
import { AGENDA_PSICOLOGIA_REPOSITORY } from '../interfaces/agenda-psicologia-repository.interface';
import type { IAgendaPsicologiaRepository } from '../interfaces/agenda-psicologia-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

/** La agenda se pide por semana o por mes (una cuadrícula de 6 semanas); nunca un rango abierto. */
const DIAS_MAXIMOS_RANGO = 42;

/** La agenda de quien consulta: citas, huecos libres y el atajo de "no asistió". */
@Injectable()
export class AgendaPsicologiaService {
  constructor(
    @Inject(AGENDA_PSICOLOGIA_REPOSITORY)
    private readonly agendaRepository: IAgendaPsicologiaRepository,
    private readonly acceso: AccesoPsicologiaService,
    private readonly auditService: AuditService,
  ) {}

  listarCitas(
    query: RangoFechasQuery,
    psicologaId: string,
  ): Promise<CitaAgendaDto[]> {
    // Las fechas son "YYYY-MM-DD": se comparan como texto, sin pasar por `Date`.
    if (
      query.hasta < query.desde ||
      query.hasta > sumarDiasGT(query.desde, DIAS_MAXIMOS_RANGO)
    ) {
      throw new BadRequestException(MENSAJE_RANGO_AGENDA_INVALIDO);
    }
    return this.agendaRepository.listarCitas({
      psicologaId,
      desde: inicioDiaGT(query.desde),
      hasta: finDiaGT(query.hasta),
      ahora: new Date(),
    });
  }

  /**
   * Tramos libres de un día dentro del horario habitual. Es solo una sugerencia de dónde hay
   * espacio: agendar fuera de ellos sigue permitido.
   */
  async huecos(
    query: HuecosAgendaQuery,
    psicologaId: string,
  ): Promise<HuecoLibreDto[]> {
    const hoy = hoyGT();
    if (query.fecha < hoy) {
      return [];
    }
    const ahora = new Date();
    const inicioDia = inicioDiaGT(query.fecha);
    const ocupadas = await this.agendaRepository.listarOcupadas({
      psicologaId,
      desde: inicioDia,
      hasta: finDiaGT(query.fecha),
    });

    return huecosLibres(
      ocupadas.map((cita) => {
        const inicioMin = minutosDelDiaGT(cita.fechaHora);
        return { inicioMin, finMin: inicioMin + cita.duracionMinutos };
      }),
      diaSemanaGT(query.fecha),
      query.fecha === hoy ? minutosDelDiaGT(ahora) : null,
    );
  }

  /** "Marcar no asistió": la cita ya pasó y la persona no llegó. No lleva texto. */
  async marcarNoAsistio(
    citaId: string,
    contexto: ContextoAuditoria,
  ): Promise<{ id: string; estado: 'NO_ASISTIO' }> {
    const cita = await this.acceso.exigirAccesoCita(citaId, contexto.usuarioId);

    const marcada = await this.agendaRepository.marcarNoAsistio(
      citaId,
      new Date(),
    );
    if (!marcada) {
      throw new ConflictException(MENSAJE_CITA_NO_MARCABLE);
    }

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'CITA_PSICOLOGICA_NO_ASISTIO',
        entidad: 'CitaPsicologica',
        entidadId: citaId,
        detalles: {
          expedienteId: cita.expedienteId,
          procesoId: cita.atencionId,
        },
      }),
    );

    return { id: citaId, estado: 'NO_ASISTIO' };
  }
}
