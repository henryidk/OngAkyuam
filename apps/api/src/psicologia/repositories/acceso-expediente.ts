import { Prisma } from '@prisma/client';

// Qué expedientes puede ver una psicóloga: los referidos a Psicología que nadie ha tomado
// (la cola es de toda el área) y los que tienen un proceso suyo. De los que tomó otra
// psicóloga no ve nada. Es la misma regla en sus dos formas (Prisma y SQL): si cambia una,
// cambia la otra.

/** Referencia "sin tomar": ninguna psicóloga se ha hecho cargo de un proceso en ese expediente. */
export const EXPEDIENTE_SIN_TOMAR = {
  atencionesPsicologicas: { none: { psicologaAsignadaId: { not: null } } },
} satisfies Prisma.ExpedienteWhereInput;

export function expedienteConProcesoDe(
  psicologaId: string,
): Prisma.ExpedienteWhereInput {
  return {
    atencionesPsicologicas: { some: { psicologaAsignadaId: psicologaId } },
  };
}

export function expedienteAccesible(
  psicologaId: string,
): Prisma.ExpedienteWhereInput {
  return {
    referidos: { some: { area: 'PSICOLOGIA' } },
    OR: [EXPEDIENTE_SIN_TOMAR, expedienteConProcesoDe(psicologaId)],
  };
}

/** `EXPEDIENTE_SIN_TOMAR` sobre una expresión SQL que da el id del expediente. */
export function sinTomarSql(expedienteId: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`NOT EXISTS (
    SELECT 1 FROM "AtencionPsicologica" t
    WHERE t."expedienteId" = ${expedienteId} AND t."psicologaAsignadaId" IS NOT NULL
  )`;
}

/** `expedienteAccesible` sobre el alias `e` de "Expediente". */
export function expedienteAccesibleSql(psicologaId: string): Prisma.Sql {
  return Prisma.sql`(
    EXISTS (
      SELECT 1 FROM "ReferidoArea" x
      WHERE x."expedienteId" = e.id AND x.area = 'PSICOLOGIA'
    )
    AND (
      ${sinTomarSql(Prisma.sql`e.id`)}
      OR EXISTS (
        SELECT 1 FROM "AtencionPsicologica" m
        WHERE m."expedienteId" = e.id AND m."psicologaAsignadaId" = ${psicologaId}
      )
    )
  )`;
}
