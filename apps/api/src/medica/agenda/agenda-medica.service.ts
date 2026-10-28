import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  fechaCalendarioGT,
  finDiaGT,
  horaGT,
  inicioDiaGT,
  lunesDeSemanaGT,
  sumarDiasGT,
} from '@akyuam/shared';
import type {
  DiaAgendaMedicaDto,
  DisponibilidadDiaDto,
  DisponibilidadMedicaQuery,
  PacienteProgramableDto,
  ProgramablesMedicaQuery,
  SemanaAgendaMedicaDto,
} from '@akyuam/shared';
import { MENSAJE_RANGO_DISPONIBILIDAD } from '../compartido/mensajes';
import { RELOJ, type IReloj } from '../../common/reloj';
import { derivarEstadoCita } from '../dominio/estado-cita';
import { diasHabilesDesde, horasLibres } from '../dominio/horario';
import {
  LECTOR_CITAS_MEDICAS,
  LECTOR_PENDIENTES_MEDICA,
  type ILectorCitasMedicas,
  type ILectorPendientesMedica,
} from '../interfaces/agenda-medica-repository.interface';
import {
  CITAS_MEDICAS_REPOSITORY,
  type ICitasMedicasRepository,
} from '../interfaces/citas-medicas-repository.interface';

const DIAS_SEMANA_LABORAL = 5;

/**
 * La Agenda de la médica: tira de la semana, día abierto con sus paneles y horas libres para los
 * modales de programar. Solo lectura; nunca devuelve datos clínicos.
 */
@Injectable()
export class AgendaMedicaService {
  constructor(
    @Inject(LECTOR_CITAS_MEDICAS)
    private readonly lectorCitas: ILectorCitasMedicas,
    @Inject(LECTOR_PENDIENTES_MEDICA)
    private readonly lectorPendientes: ILectorPendientesMedica,
    @Inject(CITAS_MEDICAS_REPOSITORY)
    private readonly citasRepository: ICitasMedicasRepository,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  async semana(fecha: string): Promise<SemanaAgendaMedicaDto> {
    const ahora = this.reloj.ahora();
    const lunes = lunesDeSemanaGT(fecha);
    const fechas = Array.from({ length: DIAS_SEMANA_LABORAL }, (_, i) =>
      sumarDiasGT(lunes, i),
    );
    const citas = await this.lectorCitas.resumenEntre(
      inicioDiaGT(lunes),
      inicioDiaGT(sumarDiasGT(lunes, DIAS_SEMANA_LABORAL)),
    );
    const dias = fechas.map((dia) => {
      const delDia = citas.filter((c) => fechaCalendarioGT(c.inicio) === dia);
      return {
        fecha: dia,
        total: delDia.length,
        conSinRegistrar: delDia.some(
          (c) => derivarEstadoCita(c, ahora) === 'SIN_REGISTRAR',
        ),
      };
    });
    return { lunes, dias };
  }

  async dia(fecha: string): Promise<DiaAgendaMedicaDto> {
    const ahora = this.reloj.ahora();
    const desde = inicioDiaGT(fecha);
    const hasta = inicioDiaGT(sumarDiasGT(fecha, 1));
    const [citas, sinRegistrar, referencias, sinProxima] = await Promise.all([
      this.lectorCitas.citasEntre(desde, hasta, ahora),
      this.lectorCitas.citasSinRegistrar(ahora, desde, hasta),
      this.lectorPendientes.referenciasPendientes(),
      this.lectorPendientes.sinProxima(),
    ]);
    return {
      fecha,
      citas,
      pendientes: referencias.map((r) => ({
        referidoId: r.referidoId,
        expedienteId: r.expedienteId,
        expedienteNumero: r.expedienteNumero,
        usuariaId: r.usuariaId,
        usuariaNombreCompleto: r.usuariaNombreCompleto,
        referidoEn: r.referidoEn,
      })),
      sinRegistrar,
      sinProxima,
    };
  }

  /** Horas libres de los próximos días hábiles. Nunca dice quién ocupa cada hora. */
  async disponibilidad(
    query: DisponibilidadMedicaQuery,
  ): Promise<DisponibilidadDiaDto[]> {
    const ahora = this.reloj.ahora();
    if (query.desde < fechaCalendarioGT(ahora)) {
      throw new BadRequestException(MENSAJE_RANGO_DISPONIBILIDAD);
    }
    const fechas = diasHabilesDesde(query.desde, query.dias);
    const ocupadas = await this.citasRepository.listarOcupadas(
      inicioDiaGT(fechas[0]),
      finDiaGT(fechas[fechas.length - 1]),
    );
    const porDia = new Map<string, Set<string>>();
    for (const inicio of ocupadas) {
      const dia = fechaCalendarioGT(inicio);
      const horas = porDia.get(dia) ?? new Set<string>();
      horas.add(horaGT(inicio));
      porDia.set(dia, horas);
    }
    return fechas.map((dia) => ({
      fecha: dia,
      libres: horasLibres(dia, porDia.get(dia) ?? new Set(), ahora),
    }));
  }

  programables(
    query: ProgramablesMedicaQuery,
  ): Promise<PacienteProgramableDto[]> {
    return this.lectorPendientes.programables(query);
  }
}
