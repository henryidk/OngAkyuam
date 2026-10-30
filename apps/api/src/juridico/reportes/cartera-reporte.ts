import type { FiltroCarteraReporte } from '../compartido/sql';

// Lo que comparten los dos reportes de Jurídico (planaudiencias.md §8.6): el filtro de año,
// cómo se audita y cómo se nombra el archivo.

export interface ArchivoReporte {
  contenido: Buffer;
  nombreArchivo: string;
  tipoContenido: string;
}

/** Los campos de año que traen los dos queries de reporte. */
export interface QueryCarteraReporte {
  anio?: number;
  desde?: string;
  hasta?: string;
}

/** Desde/Hasta solo aplican sin año (el schema los exige ahí); con una carpeta se ignoran. */
export function aFiltroCartera(
  query: QueryCarteraReporte,
): FiltroCarteraReporte {
  if (query.anio !== undefined) {
    return { anio: query.anio, rango: null };
  }
  const conRango =
    query.desde && query.hasta
      ? { desde: query.desde, hasta: query.hasta }
      : null;
  return { anio: null, rango: conRango };
}

/** Solo filtros, nunca datos de personas: va a `AuditLog.detalles`. */
export function detallesCartera(filtro: FiltroCarteraReporte) {
  return {
    anio: filtro.anio,
    desde: filtro.rango?.desde ?? null,
    hasta: filtro.rango?.hasta ?? null,
  };
}

/**
 * Parte del nombre del archivo que dice qué se descargó: la carpeta ("2014") o el rango. Nunca
 * datos de una persona.
 */
export function sufijoArchivo(filtro: FiltroCarteraReporte): string {
  if (filtro.anio !== null) {
    return String(filtro.anio);
  }
  return filtro.rango ? `${filtro.rango.desde}_${filtro.rango.hasta}` : 'todos';
}
