import { Inject, Injectable } from '@nestjs/common';
import {
  ESTADOS_CITA_PSICOLOGICA,
  TIPOS_CITA_PSICOLOGICA,
  finDiaGT,
  finMesGT,
  inicioDiaGT,
  inicioMesGT,
  mesCalendarioGT,
  type EstadoCitaPsicologica,
  type IndicadoresPsicologia,
  type IndicadoresQuery,
  type RangoFechasQuery,
  type ReportePsicologia,
  type TipoCitaPsicologica,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ATENCION_PSICOLOGICA_REPOSITORY } from '../interfaces/atencion-psicologica-repository.interface';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { INDICADORES_PSICOLOGIA_REPOSITORY } from '../interfaces/indicadores-psicologia-repository.interface';
import type { IIndicadoresPsicologiaRepository } from '../interfaces/indicadores-psicologia-repository.interface';

function contadorEnCero<T extends string>(
  claves: readonly T[],
): Record<T, number> {
  return Object.fromEntries(claves.map((clave) => [clave, 0])) as Record<
    T,
    number
  >;
}

@Injectable()
export class IndicadoresPsicologiaService {
  constructor(
    @Inject(INDICADORES_PSICOLOGIA_REPOSITORY)
    private readonly indicadoresRepository: IIndicadoresPsicologiaRepository,
    @Inject(ATENCION_PSICOLOGICA_REPOSITORY)
    private readonly atencionRepository: IAtencionPsicologicaRepository,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    private readonly auditService: AuditService,
  ) {}

  async obtenerReporte(query: RangoFechasQuery): Promise<ReportePsicologia> {
    const agregado = await this.indicadoresRepository.obtenerReporte({
      desde: inicioDiaGT(query.desde),
      hasta: finDiaGT(query.hasta),
    });
    return { desde: query.desde, hasta: query.hasta, ...agregado };
  }

  /**
   * Siempre "mis" indicadores (§5.5 del plan) — nunca agrega sobre otras psicólogas, a
   * diferencia del `obtenerReporte` legado. Solo `personasAtendidasPorMes` necesita el corte
   * de mes en GT (§7.5): el resto son totales del año, calculados aquí en memoria a partir de
   * `listarCitasEnRango`, nunca con `date_trunc` en la base de datos.
   */
  async obtenerIndicadores(
    query: IndicadoresQuery,
    psicologaId: string,
    contexto: ContextoAuditoria,
  ): Promise<IndicadoresPsicologia> {
    const desde = inicioMesGT(query.anio, 1);
    const hasta = finMesGT(query.anio, 12);

    const [
      procesosActivos,
      procesosIniciadosEnElAnio,
      procesosCerradosEnElAnio,
      citas,
    ] = await Promise.all([
      this.atencionRepository.contarCasosActivos(psicologaId),
      this.atencionRepository.contarIniciadosEnRango(psicologaId, desde, hasta),
      this.atencionRepository.contarCerradosEnRango(psicologaId, desde, hasta),
      this.citasRepository.listarCitasEnRango({ psicologaId, desde, hasta }),
    ]);

    const personasPorMes = new Map<string, Set<string>>();
    const personasEnElAnio = new Set<string>();
    const citasPorEstado = contadorEnCero<EstadoCitaPsicologica>(
      ESTADOS_CITA_PSICOLOGICA,
    );
    const distribucionPorTipoCita = contadorEnCero<TipoCitaPsicologica>(
      TIPOS_CITA_PSICOLOGICA,
    );
    const distribucionPorMunicipio: Record<string, number> = {};
    let inasistencias = 0;

    for (const cita of citas) {
      const mes = mesCalendarioGT(cita.fechaHora);
      if (!personasPorMes.has(mes)) personasPorMes.set(mes, new Set());
      personasPorMes.get(mes)!.add(cita.usuariaId);
      personasEnElAnio.add(cita.usuariaId);

      citasPorEstado[cita.estado] += 1;
      distribucionPorTipoCita[cita.tipo] += 1;
      if (cita.municipio) {
        distribucionPorMunicipio[cita.municipio] =
          (distribucionPorMunicipio[cita.municipio] ?? 0) + 1;
      }
      if (cita.estado === 'NO_ASISTIO') inasistencias += 1;
    }

    const personasAtendidasPorMes: Record<string, number> = {};
    for (const [mes, usuarias] of personasPorMes) {
      personasAtendidasPorMes[mes] = usuarias.size;
    }

    const indicadores: IndicadoresPsicologia = {
      anio: query.anio,
      procesosActivos,
      procesosIniciadosEnElAnio,
      procesosCerradosEnElAnio,
      personasAtendidasPorMes,
      personasAtendidasEnElAnio: personasEnElAnio.size,
      citasPorEstado,
      tasaInasistencia: citas.length > 0 ? inasistencias / citas.length : 0,
      distribucionPorMunicipio,
      distribucionPorTipoCita,
    };

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'INDICADORES_PSICOLOGIA_CONSULTADOS',
      entidad: 'AtencionPsicologica',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { anio: query.anio },
    });

    return indicadores;
  }
}
