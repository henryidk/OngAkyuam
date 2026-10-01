import {
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA,
  ETIQUETAS_TIPO_DOCUMENTO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  type AreaAtencion,
} from '@akyuam/shared';

/** `AuditLog.detalles` tal como sale de la BD: JSON arbitrario, solo IDs/tipos/áreas (nunca PII). */
export type DetallesAuditoria = Record<string, unknown> | null;

interface PlantillaEvento {
  /** Área que hizo la acción; null = la hizo Trabajo Social (no es novedad de un área). */
  area: AreaAtencion | null;
  /** Registro, referido o proceso — el punto de color de la bitácora. */
  destacado: boolean;
  texto: (detalles: DetallesAuditoria) => string;
}

export interface EventoDescrito {
  area: AreaAtencion | null;
  destacado: boolean;
  texto: string;
}

/** Busca la etiqueta de un valor de catálogo; si viene algo inesperado, no inventa texto. */
function etiqueta(
  catalogo: Record<string, string>,
  valor: unknown,
): string | null {
  return typeof valor === 'string' ? (catalogo[valor] ?? null) : null;
}

/** "área jurídica", "área psicológica"… — las plantillas le ponen el artículo. */
function nombreArea(detalles: DetallesAuditoria): string {
  const area = etiqueta(ETIQUETAS_AREA_ATENCION, detalles?.area);
  return area ? `área ${area.toLowerCase()}` : 'área';
}

function nombreDocumento(detalles: DetallesAuditoria): string {
  const tipo = etiqueta(ETIQUETAS_TIPO_DOCUMENTO, detalles?.tipo);
  return tipo ? `«${tipo}»` : 'un documento';
}

/**
 * Acción de `AuditLog` → frase en lenguaje natural. Es una lista blanca: lo que no está aquí
 * (lecturas, descargas, notas clínicas, documentos de sesiones de psicología) nunca llega a la
 * bitácora ni a las novedades. Agregar un evento visible = agregar una entrada.
 */
const PLANTILLAS: Record<string, PlantillaEvento> = {
  EXPEDIENTE_CREADO: {
    area: null,
    destacado: true,
    texto: (detalles) =>
      typeof detalles?.numero === 'string'
        ? `Registró el caso ${detalles.numero}`
        : 'Registró el caso',
  },
  EXPEDIENTE_REFERIDO: {
    area: null,
    destacado: true,
    texto: (detalles) =>
      `Refirió el caso al ${nombreArea(detalles)}${detalles?.prioridad === 'URGENTE' ? ' (urgente)' : ''}`,
  },
  EGRESO_ALBERGUE_REGISTRADO: {
    area: null,
    destacado: true,
    texto: () => 'Registró el egreso del albergue',
  },
  ACCESO_AREA_MODIFICADO: {
    area: null,
    destacado: true,
    texto: (detalles) => `Cambió lo que puede ver el ${nombreArea(detalles)}`,
  },
  DOCUMENTO_SUBIDO: {
    area: null,
    destacado: false,
    texto: (detalles) => `Subió ${nombreDocumento(detalles)}`,
  },
  DOCUMENTO_VERSION_SUBIDA: {
    area: null,
    destacado: false,
    texto: (detalles) =>
      typeof detalles?.version === 'number'
        ? `Subió la versión ${detalles.version} de ${nombreDocumento(detalles)}`
        : `Actualizó ${nombreDocumento(detalles)}`,
  },
  USUARIA_ACTUALIZADA: {
    area: null,
    destacado: false,
    texto: () => 'Actualizó los datos personales',
  },
  PROCESO_JURIDICO_CREADO: {
    area: 'JURIDICO',
    destacado: true,
    texto: (detalles) => {
      const tipo = etiqueta(ETIQUETAS_TIPO_PROCESO_JURIDICO, detalles?.tipo);
      return tipo
        ? `Jurídico abrió un proceso (${tipo})`
        : 'Jurídico abrió un proceso';
    },
  },
  PROCESO_JURIDICO_CERRADO: {
    area: 'JURIDICO',
    destacado: true,
    texto: () => 'Jurídico cerró un proceso',
  },
  ABANDONO_REGISTRADO: {
    area: 'JURIDICO',
    destacado: false,
    texto: () => 'Jurídico registró el abandono de un proceso',
  },
  ATENCION_PSICOLOGICA_TOMADA: {
    area: 'PSICOLOGIA',
    destacado: true,
    texto: () => 'Psicología tomó el caso',
  },
  CITA_PSICOLOGICA_PROGRAMADA: {
    area: 'PSICOLOGIA',
    destacado: false,
    texto: () => 'Psicología programó una cita',
  },
  ATENCION_PSICOLOGICA_ESTADO_ACTUALIZADO: {
    area: 'PSICOLOGIA',
    destacado: false,
    texto: (detalles) => {
      const estado = etiqueta(
        ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA,
        detalles?.estado,
      );
      return estado
        ? `Psicología cambió el estado de la atención a ${estado.toLowerCase()}`
        : 'Psicología cambió el estado de la atención';
    },
  },
};

/** Todas las acciones visibles en la bitácora. */
export const ACCIONES_BITACORA = Object.keys(PLANTILLAS);

/** Solo las que hizo un área: son las "Novedades de las áreas" de la bandeja. */
export const ACCIONES_NOVEDAD_AREA = Object.entries(PLANTILLAS)
  .filter(([, plantilla]) => plantilla.area !== null)
  .map(([accion]) => accion);

export function describirEvento(
  accion: string,
  detalles: DetallesAuditoria,
): EventoDescrito | null {
  const plantilla = PLANTILLAS[accion];
  if (!plantilla) {
    return null;
  }
  return {
    area: plantilla.area,
    destacado: plantilla.destacado,
    texto: plantilla.texto(detalles),
  };
}
