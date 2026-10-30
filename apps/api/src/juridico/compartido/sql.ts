import { Prisma } from '@prisma/client';
import { GUATEMALA_TZ, separarNumeroInterno } from '@akyuam/shared';

/** `%` y `_` son comodines de LIKE: lo que escribe la persona se busca literal. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

/** La regla de acceso del módulo sobre el alias `p` de "ProcesoJuridico", para SQL crudo. */
export const PROCESO_CON_ACCESO_SQL = Prisma.sql`EXISTS (
  SELECT 1 FROM "ReferidoArea" r
  WHERE r."expedienteId" = p."expedienteId" AND r.area = 'JURIDICO'
)`;

/** En trámite: ni finalizado, ni suspendido, ni abandonado. */
export const EN_TRAMITE_SQL = Prisma.sql`(p.fase <> 'FINALIZADO' AND p.situacion = 'ACTIVO')`;

/** La ficha de personal de esa cuenta es la abogada o la procuradora del proceso `p`. */
export function asignadoASql(usuarioId: string): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM "Personal" pe
    WHERE pe."usuarioId" = ${usuarioId}
      AND pe.id IN (p."abogadaId", p."procuradoraId")
  )`;
}

/** El estado que ve el personal, igual que `estadoVisible()`: finalizado gana sobre la situación. */
export const ESTADO_VISIBLE_SQL = Prisma.sql`(CASE
  WHEN p.fase = 'FINALIZADO' THEN 'FINALIZADO'
  WHEN p.situacion = 'SUSPENDIDO' THEN 'SUSPENDIDO'
  WHEN p.situacion = 'ABANDONADO' THEN 'ABANDONADO'
  ELSE 'EN_TRAMITE'
END)`;

/** Ni finalizado ni abandonado, igual que `esProcesoActivo()`. */
export const PROCESO_ABIERTO_SQL = Prisma.sql`(p.fase <> 'FINALIZADO' AND p.situacion <> 'ABANDONADO')`;

/** Columnas sobre las que se filtra por año: las de un proceso o las de un expediente. */
export interface ColumnasCarteraSql {
  /** Fecha de calendario (`date`) del expediente: define la carpeta. */
  fechaExpediente: Prisma.Sql;
  /** Fecha de calendario (`date`) de inicio: la que se compara con Desde/Hasta. */
  fechaInicio: Prisma.Sql;
}

const COLUMNAS_CARTERA_PROCESO: ColumnasCarteraSql = {
  fechaExpediente: Prisma.sql`e.fecha`,
  fechaInicio: Prisma.sql`p."fechaInicio"`,
};

/** Año de una fecha de calendario (`date`), igual que `anioDeFecha()` de shared. */
export function anioDeFechaSql(fecha: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`EXTRACT(YEAR FROM ${fecha})::int`;
}

/**
 * La carpeta `anio`: el expediente se registró ese año ("05-2014" → 2014). Se compara como rango
 * de fechas, no con EXTRACT, para que pueda usar un índice sobre la fecha. Por defecto, sobre `e`.
 */
export function carpetaAnioSql(
  anio: number,
  fechaExpediente: Prisma.Sql = COLUMNAS_CARTERA_PROCESO.fechaExpediente,
): Prisma.Sql {
  return Prisma.sql`(${fechaExpediente} >= make_date(${anio}::int, 1, 1) AND ${fechaExpediente} < make_date(${anio}::int + 1, 1, 1))`;
}

/** Filtro de año de los reportes: una carpeta o, sin año, todos los años dentro del rango. */
export interface FiltroCarteraReporte {
  /** null = todos los años. */
  anio: number | null;
  /** Solo sin año: "YYYY-MM-DD", inclusive. */
  rango: { desde: string; hasta: string } | null;
}

export function carteraReporteSql(
  filtro: FiltroCarteraReporte,
  columnas: ColumnasCarteraSql = COLUMNAS_CARTERA_PROCESO,
): Prisma.Sql {
  if (filtro.anio !== null) {
    return carpetaAnioSql(filtro.anio, columnas.fechaExpediente);
  }
  return filtro.rango
    ? Prisma.sql`(${columnas.fechaInicio} BETWEEN ${filtro.rango.desde}::date AND ${filtro.rango.hasta}::date)`
    : Prisma.sql`TRUE`;
}

/**
 * Fecha de calendario en Guatemala de un instante (`timestamptz`), por nombre de zona IANA,
 * igual que `fechaCalendarioGT()`: nunca con un desfase fijo.
 */
export function fechaCalendarioGTSql(instante: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(${instante} AT TIME ZONE ${GUATEMALA_TZ})::date`;
}

/**
 * Búsqueda por No. interno completo ("05-2026 · Proceso 2"): el código no es una columna, se
 * separa en expediente + consecutivo (H1). `null` si el término no tiene esa forma.
 */
export function numeroInternoSql(termino: string): Prisma.Sql | null {
  const numero = separarNumeroInterno(termino);
  return numero
    ? Prisma.sql`(e.numero = ${numero.expedienteNumero} AND p.consecutivo = ${numero.consecutivo})`
    : null;
}
