import { Prisma } from '@prisma/client';
import { separarNumeroInterno, type CarteraJuridico } from '@akyuam/shared';

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

/**
 * Cartera del proceso `p`, la misma regla que `carteraDe()` de shared: del año si empezó en
 * `anioActual`; de seguimiento si empezó antes y sigue abierto.
 */
export function carteraSql(
  cartera: CarteraJuridico,
  anioActual: number,
): Prisma.Sql {
  switch (cartera) {
    case 'ANIO':
      return Prisma.sql`p."fechaInicio" >= ${inicioDeAnioSql(anioActual)}`;
    case 'SEGUIMIENTO':
      return Prisma.sql`(${PROCESO_ABIERTO_SQL} AND p."fechaInicio" < ${inicioDeAnioSql(anioActual)})`;
    case 'TODOS':
      return Prisma.sql`TRUE`;
  }
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
