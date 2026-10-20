import { Prisma } from '@prisma/client';
import {
  GUATEMALA_TZ,
  separarNumeroInterno,
  type CarteraJuridico,
} from '@akyuam/shared';

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

/** 1 de enero de `anio`: `fechaInicio` es una fecha de calendario, se compara como `date`. */
function inicioDeAnioSql(anio: number): Prisma.Sql {
  return Prisma.sql`make_date(${anio}::int, 1, 1)`;
}

/** Columnas sobre las que se evalúa la cartera: las de un proceso o las de un expediente. */
export interface ColumnasCarteraSql {
  /** Fecha de calendario (`date`) de inicio. */
  fechaInicio: Prisma.Sql;
  /** Expresión booleana: sigue abierto. */
  abierto: Prisma.Sql;
}

const COLUMNAS_CARTERA_PROCESO: ColumnasCarteraSql = {
  fechaInicio: Prisma.sql`p."fechaInicio"`,
  abierto: PROCESO_ABIERTO_SQL,
};

/**
 * La misma regla que `carteraDe()` de shared: del año si empezó en `anioActual`; de
 * seguimiento si empezó antes y sigue abierto. Por defecto, sobre el proceso `p`.
 */
export function carteraSql(
  cartera: CarteraJuridico,
  anioActual: number,
  columnas: ColumnasCarteraSql = COLUMNAS_CARTERA_PROCESO,
): Prisma.Sql {
  switch (cartera) {
    case 'ANIO':
      return Prisma.sql`${columnas.fechaInicio} >= ${inicioDeAnioSql(anioActual)}`;
    case 'SEGUIMIENTO':
      return Prisma.sql`(${columnas.abierto} AND ${columnas.fechaInicio} < ${inicioDeAnioSql(anioActual)})`;
    case 'TODOS':
      return Prisma.sql`TRUE`;
  }
}

/** Filtro de cartera de los reportes: además, en "Todos" la fecha de inicio cae en el rango. */
export interface FiltroCarteraReporte {
  cartera: CarteraJuridico;
  anioActual: number;
  /** Solo en "Todos": "YYYY-MM-DD", inclusive. */
  rango: { desde: string; hasta: string } | null;
}

export function carteraReporteSql(
  filtro: FiltroCarteraReporte,
  columnas: ColumnasCarteraSql = COLUMNAS_CARTERA_PROCESO,
): Prisma.Sql {
  const porRango = filtro.rango
    ? Prisma.sql`AND ${columnas.fechaInicio} BETWEEN ${filtro.rango.desde}::date AND ${filtro.rango.hasta}::date`
    : Prisma.empty;
  return Prisma.sql`(${carteraSql(filtro.cartera, filtro.anioActual, columnas)} ${porRango})`;
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
