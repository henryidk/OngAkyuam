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

/**
 * Proceso que llevó otra psicóloga y que esta puede leer: ya está cerrado y ella atiende o
 * atendió a la misma usuaria (en cualquiera de sus expedientes). Es para que quien retoma a una
 * usuaria conozca lo que se trabajó antes; uno que sigue abierto solo lo ve su dueña.
 */
export function procesoCerradoDeColega(
  psicologaId: string,
): Prisma.AtencionPsicologicaWhereInput {
  return {
    estado: 'CIERRE',
    AND: [
      { psicologaAsignadaId: { not: null } },
      { psicologaAsignadaId: { not: psicologaId } },
    ],
    expediente: {
      usuaria: { expedientes: { some: expedienteConProcesoDe(psicologaId) } },
    },
  };
}

/**
 * Qué procesos puede LEER una psicóloga: los suyos y los cerrados de una colega con una usuaria
 * que también es suya. Solo para lecturas: escribir sigue siendo cosa de la dueña.
 */
export function procesoLegible(
  psicologaId: string,
): Prisma.AtencionPsicologicaWhereInput {
  return {
    OR: [
      { psicologaAsignadaId: psicologaId },
      procesoCerradoDeColega(psicologaId),
    ],
  };
}

/**
 * Caso o proceso que quedó sin quien lo atienda: sigue abierto y la cuenta de su psicóloga está
 * desactivada. Cualquier psicóloga puede tomarlo. No se guarda en ningún lado: se deduce de la
 * cuenta, así que si la reactivan, lo que nadie tomó vuelve a ser solo de ella.
 */
export const PROCESO_POR_REASIGNAR = {
  estado: { not: 'CIERRE' },
  psicologaAsignada: { isActive: false },
} satisfies Prisma.AtencionPsicologicaWhereInput;

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
