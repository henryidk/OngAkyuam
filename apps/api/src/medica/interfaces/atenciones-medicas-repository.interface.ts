import type { MotivoAltaMedica } from '@akyuam/shared';

export interface DarAltaParams {
  atencionId: string;
  version: number;
  motivo: MotivoAltaMedica;
  nota: string | null;
  /** Fecha de calendario del alta en Guatemala. */
  fechaAlta: string;
  /** Se cancelan las citas programadas que empiezan después de este instante. */
  ahora: Date;
}

export interface ActualizarVisibilidadParams {
  atencionId: string;
  version: number;
  juridico?: boolean;
  psicologia?: boolean;
}

export interface VisibilidadActualizada {
  version: number;
  visibleJuridico: boolean;
  visiblePsicologia: boolean;
}

export interface IAtencionesMedicasRepository {
  /**
   * Alta y cancelación de las citas futuras en una sola transacción. Devuelve cuántas citas se
   * cancelaron. Lanza `VersionCambioError` o `AtencionNoActivaError`.
   */
  darAlta(params: DarAltaParams): Promise<number>;
  /** Lanza `VersionCambioError` si la versión leída ya no es la actual. */
  actualizarVisibilidad(
    params: ActualizarVisibilidadParams,
  ): Promise<VisibilidadActualizada>;
}

export const ATENCIONES_MEDICAS_REPOSITORY = Symbol(
  'ATENCIONES_MEDICAS_REPOSITORY',
);
