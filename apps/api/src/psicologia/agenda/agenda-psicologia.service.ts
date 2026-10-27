import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  HORARIO_PSICOLOGIA,
  PASO_HORARIO_PSICOLOGIA_MIN,
  SEMANAS_DISPONIBILIDAD_PSICOLOGIA,
  diaSemanaGT,
  fechaCalendarioGT,
  finDiaGT,
  hoyGT,
  inicioDiaGT,
  minutosDelDiaGT,
  parseLocalGT,
  sumarDiasGT,
} from '@akyuam/shared';
import type {
  AgendarCitaPsicologicaInput,
  CitaAgendaDto,
  CitaProgramadaDto,
  DisponibilidadDiaDto,
  DisponibilidadPsicologiaQuery,
  HuecoLibreDto,
  HuecosAgendaQuery,
  MoverCitaPsicologicaInput,
  ProcesoParaAgendarDto,
  RangoFechasQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_CITA_NO_MARCABLE,
  MENSAJE_CITA_NO_REPROGRAMABLE,
  MENSAJE_PERSONA_AJENA,
  MENSAJE_PROCESO_CERRADO,
  MENSAJE_RANGO_AGENDA_INVALIDO,
} from '../compartido/mensajes';
import { avisarTraslape } from '../compartido/traslape';
import { estaCerrado } from '../dominio/etapa-proceso';
import { horasDeInicio, huecosLibres } from '../dominio/huecos-libres';
import { AGENDA_PSICOLOGIA_REPOSITORY } from '../interfaces/agenda-psicologia-repository.interface';
import type { IAgendaPsicologiaRepository } from '../interfaces/agenda-psicologia-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

/** La agenda se pide por semana o por mes (una cuadrícula de 6 semanas); nunca un rango abierto. */
const DIAS_MAXIMOS_RANGO = 42;

/** La agenda de quien consulta: citas, huecos libres, programar, mover y el atajo de "no asistió". */
@Injectable()
export class AgendaPsicologiaService {
  constructor(
    @Inject(AGENDA_PSICOLOGIA_REPOSITORY)
    private readonly agendaRepository: IAgendaPsicologiaRepository,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
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

  /**
   * Horas de inicio libres de cada día hábil, desde `desde` hasta unas semanas adelante, donde
   * cabe completa una cita de `duracion` minutos. Solo mira la agenda de quien consulta y nunca
   * dice qué ocupa cada hora. Es una sugerencia: agendar fuera de estas horas sigue permitido.
   */
  async disponibilidad(
    query: DisponibilidadPsicologiaQuery,
    psicologaId: string,
  ): Promise<DisponibilidadDiaDto[]> {
    const ahora = new Date();
    const hoy = fechaCalendarioGT(ahora);
    const desde = query.desde < hoy ? hoy : query.desde;
    const hasta = sumarDiasGT(hoy, SEMANAS_DISPONIBILIDAD_PSICOLOGIA * 7);
    const fechas: string[] = [];
    for (let dia = desde; dia <= hasta; dia = sumarDiasGT(dia, 1)) {
      if (
        (HORARIO_PSICOLOGIA.diasLaborables as readonly number[]).includes(
          diaSemanaGT(dia),
        )
      ) {
        fechas.push(dia);
      }
    }
    if (fechas.length === 0) {
      return [];
    }

    const ocupadas = await this.agendaRepository.listarOcupadas({
      psicologaId,
      desde: inicioDiaGT(fechas[0]),
      hasta: finDiaGT(fechas[fechas.length - 1]),
    });
    const porDia = new Map<string, { inicioMin: number; finMin: number }[]>();
    for (const cita of ocupadas) {
      const dia = fechaCalendarioGT(cita.fechaHora);
      const inicioMin = minutosDelDiaGT(cita.fechaHora);
      const tramos = porDia.get(dia) ?? [];
      tramos.push({ inicioMin, finMin: inicioMin + cita.duracionMinutos });
      porDia.set(dia, tramos);
    }

    return fechas.map((dia) => ({
      fecha: dia,
      libres: horasDeInicio(
        huecosLibres(
          porDia.get(dia) ?? [],
          diaSemanaGT(dia),
          dia === hoy ? minutosDelDiaGT(ahora) : null,
        ),
        query.duracion,
        PASO_HORARIO_PSICOLOGIA_MIN,
      ),
    }));
  }

  /**
   * "Marcar no asistió": la cita ya pasó y la persona no llegó. No lleva texto. Es un registro
   * de la sesión: lo hace quien la tenía asignada.
   */
  async marcarNoAsistio(
    citaId: string,
    contexto: ContextoAuditoria,
  ): Promise<{ id: string; estado: 'NO_ASISTIO' }> {
    const cita = await this.acceso.exigirAutoriaCita(
      citaId,
      contexto.usuarioId,
    );

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

  /** Mis procesos abiertos: alimenta el selector de "Programar cita" y "Sin próxima cita". */
  listarProcesosParaAgendar(
    psicologaId: string,
  ): Promise<ProcesoParaAgendarDto[]> {
    return this.agendaRepository.listarProcesosParaAgendar(
      psicologaId,
      new Date(),
    );
  }

  /** Cita de seguimiento en un proceso propio que siga abierto, siempre para la persona del proceso. */
  async programarCita(
    procesoId: string,
    datos: AgendarCitaPsicologicaInput,
    contexto: ContextoAuditoria,
  ): Promise<CitaProgramadaDto> {
    const proceso = await this.acceso.exigirAccesoProceso(
      procesoId,
      contexto.usuarioId,
    );
    if (estaCerrado(proceso.etapa)) {
      throw new ConflictException(MENSAJE_PROCESO_CERRADO);
    }
    // Un proceso por persona: la cita no puede ser para alguien distinto de quien lo tiene.
    if (datos.ninoId !== proceso.ninoId) {
      throw new BadRequestException(MENSAJE_PERSONA_AJENA);
    }

    const fechaHora = parseLocalGT(datos.fechaHora);
    await this.avisarTraslape(datos, fechaHora, contexto.usuarioId);

    const citaId = await this.agendaRepository.programarCita({
      procesoId,
      psicologaId: contexto.usuarioId,
      fechaHora,
      duracionMinutos: datos.duracionMinutos,
      ninoId: proceso.ninoId,
    });
    if (citaId === null) {
      throw new ConflictException(MENSAJE_PROCESO_CERRADO);
    }

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'CITA_PSICOLOGICA_PROGRAMADA',
        entidad: 'CitaPsicologica',
        entidadId: citaId,
        detalles: { expedienteId: proceso.expedienteId, procesoId },
      }),
    );

    return { id: citaId, procesoId, fechaHora: fechaHora.toISOString() };
  }

  /** "Reprogramar": la cita pasa a otra fecha; la persona atendida es la misma. */
  async moverCita(
    citaId: string,
    datos: MoverCitaPsicologicaInput,
    contexto: ContextoAuditoria,
  ): Promise<CitaProgramadaDto> {
    const cita = await this.acceso.exigirAccesoCita(citaId, contexto.usuarioId);

    const fechaHora = parseLocalGT(datos.fechaHora);
    await this.avisarTraslape(datos, fechaHora, contexto.usuarioId, citaId);

    const nuevaId = await this.agendaRepository.moverCita({
      citaId,
      psicologaId: contexto.usuarioId,
      fechaHora,
      duracionMinutos: datos.duracionMinutos,
    });
    if (nuevaId === null) {
      throw new ConflictException(MENSAJE_CITA_NO_REPROGRAMABLE);
    }

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'CITA_PSICOLOGICA_REPROGRAMADA',
        entidad: 'CitaPsicologica',
        entidadId: nuevaId,
        detalles: {
          expedienteId: cita.expedienteId,
          procesoId: cita.atencionId,
          citaAnteriorId: citaId,
        },
      }),
    );

    return {
      id: nuevaId,
      procesoId: cita.atencionId,
      fechaHora: fechaHora.toISOString(),
    };
  }

  private avisarTraslape(
    datos: { duracionMinutos: number; confirmarTraslape: boolean },
    fechaHora: Date,
    psicologaId: string,
    excluirCitaId?: string,
  ): Promise<void> {
    return avisarTraslape(this.citasRepository, {
      psicologaId,
      fechaHora,
      duracionMinutos: datos.duracionMinutos,
      confirmarTraslape: datos.confirmarTraslape,
      excluirCitaId,
    });
  }
}
