import type { FiltroCarteraReporte } from '../compartido/sql';

// Lo del reporte de procesos de Jurídico (planaudiencias.md §8.6): el filtro de año,
// cómo se audita y cómo se nombra el archivo.

export interface ArchivoReporte {
  contenido: Buffer;
  nombreArchivo: string;
  tipoContenido: string;
}

/** Los campos de año del query del reporte. */
export interface QueryCarteraReporte {
  anio?: number;
  desde?: string;
  hasta?: string;
}

/**
 * Sin año el schema exige Desde y Hasta; con una carpeta son opcionales y acotan sus procesos por
 * fecha de inicio.
 */
export function aFiltroCartera(
  query: QueryCarteraReporte,
): FiltroCarteraReporte {
  const desde = query.desde || null;
  const hasta = query.hasta || null;
  return {
    anio: query.anio ?? null,
    rango: desde || hasta ? { desde, hasta } : null,
  };
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
 * Parte del nombre del archivo que dice qué se descargó: la carpeta ("2014"), el rango o los dos
 * ("2026_2026-01-01_2026-03-31"). Nunca datos de una persona.
 */
export function sufijoArchivo(filtro: FiltroCarteraReporte): string {
  const partes: string[] = [];
  if (filtro.anio !== null) partes.push(String(filtro.anio));
  if (filtro.rango) {
    partes.push(
      `${filtro.rango.desde ?? 'inicio'}_${filtro.rango.hasta ?? 'hoy'}`,
    );
  }
  return partes.length > 0 ? partes.join('_') : 'todos';
}
