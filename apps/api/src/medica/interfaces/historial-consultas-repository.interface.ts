import type {
  ConsultaMedicaDto,
  HistorialConsultasMedicaPaginaDto,
} from '@akyuam/shared';
import type { BusquedaListaUsuarias } from '../../common/busqueda-usuarias';

export interface FiltroHistorialConsultas {
  /** Consultas con `fechaHora` en [desde, hasta). */
  desde: Date;
  hasta: Date;
  busqueda: BusquedaListaUsuarias | undefined;
  cursor: string | undefined;
}

/** Lecturas del historial de consultas. Solo ve expedientes referidos a Medicina. */
export interface IHistorialConsultasRepository {
  /** Filas sin contenido clínico, de la más reciente a la más antigua. */
  listar(
    filtro: FiltroHistorialConsultas,
  ): Promise<HistorialConsultasMedicaPaginaDto>;
  /** La consulta completa; `null` si no existe o no es de un expediente referido a Medicina. */
  detalle(consultaId: string): Promise<ConsultaMedicaDto | null>;
}

export const HISTORIAL_CONSULTAS_REPOSITORY = Symbol(
  'HISTORIAL_CONSULTAS_REPOSITORY',
);
