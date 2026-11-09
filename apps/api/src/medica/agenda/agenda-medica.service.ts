import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  PAGINA_SIN_PROXIMA_MEDICA,
  fechaCalendarioGT,
  finDiaGT,
  inicioDiaGT,
  limiteAgendaMedica,
  lunesDeSemanaGT,
  sumarDiasGT,
} from '@akyuam/shared';
import type {
  DiaAgendaMedicaDto,
  DisponibilidadDiaDto,
  DisponibilidadMedicaQuery,
  ListarSinProximaMedicaDatos,
  PacienteProgramableDto,
  ProgramablesMedicaQuery,
  SemanaAgendaMedicaDto,
  SinProximaMedicaPaginaDto,
} from '@akyuam/shared';
import { interpretarBusqueda } from '../../common/busqueda-usuarias';
import { MENSAJE_RANGO_DISPONIBILIDAD } from '../compartido/mensajes';
import { RELOJ, type IReloj } from '../../common/reloj';
import { derivarEstadoCita } from '../dominio/estado-cita';
import { corteSinVenir } from '../dominio/sin-proxima';
import {
  bloquesOcupadosPorDia,
  diasHabilesEntre,
  horasLibres,
} from '../dominio/horario';
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
 * La Agenda de la médica: tira de la semana, día abierto, "Sin próxima consulta" por páginas y
 * horas libres para los modales de programar. Registrar e inasistencias viven en Consultas › Por registrar. Solo lectura; nunca devuelve datos clínicos.
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
    const citas = await this.lectorCitas.citasEntre(
      inicioDiaGT(fecha),
      inicioDiaGT(sumarDiasGT(fecha, 1)),
      this.reloj.ahora(),
    );
    return { fecha, citas };
  }

  /**
   * "Sin próxima consulta" de Pacientes, por páginas numeradas: una página del grupo pedido y los
   * totales de cada grupo con la misma búsqueda. Toda el área (la agenda es compartida).
   */
  async sinProxima(
    datos: ListarSinProximaMedicaDatos,
  ): Promise<SinProximaMedicaPaginaDto> {
    const filtro = {
      busqueda: interpretarBusqueda(datos.q),
      grupo: datos.grupo,
      corte: corteSinVenir(this.reloj.ahora()),
    };
    const porPagina = PAGINA_SIN_PROXIMA_MEDICA;
    const [items, conteos] = await Promise.all([
      this.lectorPendientes.paginaSinProxima(filtro, datos.pagina, porPagina),
      this.lectorPendientes.conteosSinProxima({
        busqueda: filtro.busqueda,
        corte: filtro.corte,
      }),
    ]);
    return {
      items,
      total: conteos[datos.grupo ?? 'TODAS'],
      pagina: datos.pagina,
      porPagina,
      conteos,
    };
  }

  /**
   * Horas de cada día hábil, de `query.desde` hasta el límite de agenda (un mes), en las que cabe
   * una cita de `query.duracion`. Nunca dice quién ocupa cada hora.
   */
  async disponibilidad(
    query: DisponibilidadMedicaQuery,
  ): Promise<DisponibilidadDiaDto[]> {
    const ahora = this.reloj.ahora();
    const hoy = fechaCalendarioGT(ahora);
    const limite = limiteAgendaMedica(hoy);
    if (query.desde < hoy || query.desde > limite) {
      throw new BadRequestException(MENSAJE_RANGO_DISPONIBILIDAD);
    }
    const fechas = diasHabilesEntre(query.desde, limite);
    if (fechas.length === 0) {
      return [];
    }
    const ocupadas = await this.citasRepository.listarOcupadas(
      inicioDiaGT(fechas[0]),
      finDiaGT(fechas[fechas.length - 1]),
    );
    const porDia = bloquesOcupadosPorDia(ocupadas);
    return fechas.map((dia) => ({
      fecha: dia,
      libres: horasLibres(
        dia,
        porDia.get(dia) ?? new Set(),
        ahora,
        query.duracion,
      ),
    }));
  }

  programables(
    query: ProgramablesMedicaQuery,
  ): Promise<PacienteProgramableDto[]> {
    return this.lectorPendientes.programables(query);
  }
}
