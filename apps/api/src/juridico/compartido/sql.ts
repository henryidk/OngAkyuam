import { Prisma } from '@prisma/client';

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
