import type { CarteraJuridico } from '@akyuam/shared';
import type { FiltroCarteraReporte } from '../compartido/sql';

// Lo que comparten los dos reportes de Jurídico (planaudiencias.md §8.6): el filtro Cartera,
// cómo se audita y cómo se nombra el archivo.

export interface ArchivoReporte {
  contenido: Buffer;
  nombreArchivo: string;
  tipoContenido: string;
}

/** Los campos de cartera que traen los dos queries de reporte. */
export interface QueryCarteraReporte {
  cartera: CarteraJuridico;
  desde?: string;
  hasta?: string;
}

/** Desde/Hasta solo aplican en "Todos" (el schema los exige ahí); en las otras se ignoran. */
export function aFiltroCartera(
  query: QueryCarteraReporte,
  anioActual: number,
): FiltroCarteraReporte {
  const conRango =
    query.cartera === 'TODOS' && query.desde && query.hasta
      ? { desde: query.desde, hasta: query.hasta }
      : null;
  return { cartera: query.cartera, anioActual, rango: conRango };
}

/** Solo filtros, nunca datos de personas: va a `AuditLog.detalles`. */
export function detallesCartera(filtro: FiltroCarteraReporte) {
  return {
    cartera: filtro.cartera,
    anio: filtro.anioActual,
    desde: filtro.rango?.desde ?? null,
    hasta: filtro.rango?.hasta ?? null,
  };
}

/**
 * Parte del nombre del archivo que dice qué se descargó: "2026", "seguimiento_2026-10-19" (es la
 * foto de hoy) o el rango. Nunca datos de una persona.
 */
export function sufijoArchivo(
  filtro: FiltroCarteraReporte,
  hoy: string,
): string {
  if (filtro.rango) {
    return `${filtro.rango.desde}_${filtro.rango.hasta}`;
  }
  return filtro.cartera === 'SEGUIMIENTO'
    ? `seguimiento_${hoy}`
    : String(filtro.anioActual);
}
