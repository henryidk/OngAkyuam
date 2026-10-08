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
  parseLocalGT,
  sumarDiasGT,
} from '@akyuam/shared';
import type {
  AgendarCitaPsicologicaInput,
  CitaAgendaDto,
  CitaProgramadaDto,
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
  CODIGO_TRASLAPE_CITA,
  MENSAJE_CITA_NO_MARCABLE,
  MENSAJE_CITA_NO_REPROGRAMABLE,
  MENSAJE_PERSONA_AJENA,
  MENSAJE_PROCESO_CERRADO,
  MENSAJE_RANGO_AGENDA_INVALIDO,
  MENSAJE_TRASLAPE,
} from '../compartido/mensajes';
import { estaCerrado } from '../dominio/etapa-proceso';
import { huecosLibres } from '../dominio/huecos-libres';
import { AGENDA_PSICOLOGIA_REPOSITORY } from '../interfaces/agenda-psicologia-repository.interface';
import type { IAgendaPsicologiaRepository } from '../interfaces/agenda-psicologia-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { PROCESOS_PSICOLOGIA_REPOSITORY } from '../interfaces/procesos-psicologia-repository.interface';
import type { IProcesosPsicologiaRepository } from '../interfaces/procesos-psicologia-repository.interface';
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
    @Inject(PROCESOS_PSICOLOGIA_REPOSITORY)
    private readonly procesosRepository: IProcesosPsicologiaRepository,
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

  /** Mis procesos abiertos: alimenta el selector de "Programar cita" y "Sin próxima cita". */
  listarProcesosParaAgendar(
    psicologaId: string,
  ): Promise<ProcesoParaAgendarDto[]> {
    return this.agendaRepository.listarProcesosParaAgendar(
      psicologaId,
      new Date(),
    );
  }

  /** Cita de seguimiento en un proceso propio que siga abierto, para la usuaria o un hijo/a suyo. */
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
    if (
      datos.ninoId !== null &&
      !(await this.procesosRepository.ninoPerteneceAExpediente(
        datos.ninoId,
        proceso.expedienteId,
      ))
    ) {
      throw new BadRequestException(MENSAJE_PERSONA_AJENA);
    }

    const fechaHora = parseLocalGT(datos.fechaHora);
    await this.avisarTraslape(datos, fechaHora, contexto.usuarioId);

    const citaId = await this.agendaRepository.programarCita({
      procesoId,
      psicologaId: contexto.usuarioId,
      fechaHora,
      duracionMinutos: datos.duracionMinutos,
      ninoId: datos.ninoId,
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

  /** El traslape no bloquea: avisa una vez con 409 y la psicóloga puede confirmar. */
  private async avisarTraslape(
    datos: { duracionMinutos: number; confirmarTraslape: boolean },
    fechaHora: Date,
    psicologaId: string,
    excluirCitaId?: string,
  ): Promise<void> {
    if (datos.confirmarTraslape) {
      return;
    }
    const solapadas = await this.citasRepository.buscarCitasSolapadas({
      psicologaId,
      fechaHora,
      duracionMinutos: datos.duracionMinutos,
      excluirCitaId,
    });
    if (solapadas.length > 0) {
      throw new ConflictException({
        message: MENSAJE_TRASLAPE,
        codigo: CODIGO_TRASLAPE_CITA,
        detalle: { citas: solapadas },
      });
    }
  }
}
