import { etiquetaProcesoPsicologia } from '@akyuam/shared';

/** Lo que hace falta leer de un proceso para mostrar su código ("04-2026.01 · Proceso 2"). */
export const SELECT_CODIGO_PROCESO = {
  consecutivo: true,
  nino: { select: { consecutivo: true } },
} as const;

export function codigoProceso(
  expedienteNumero: string,
  proceso: { consecutivo: number; nino: { consecutivo: number } | null },
): string {
  return etiquetaProcesoPsicologia(
    expedienteNumero,
    proceso.consecutivo,
    proceso.nino?.consecutivo ?? null,
  );
}
