import { Prisma } from '@prisma/client';

// Lectura compartida de toda Psicología sobre expedientes referidos al área.
// La edición mantiene las verificaciones de responsable en los repositorios.

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
  _psicologaId: string,
): Prisma.ExpedienteWhereInput {
  void _psicologaId;
  return { referidos: { some: { area: 'PSICOLOGIA' } } };
}

/** Lectura de procesos de cualquier psicóloga; nunca se usa para autorizar escrituras. */
export function procesoLegible(
  _psicologaId: string,
): Prisma.AtencionPsicologicaWhereInput {
  void _psicologaId;
  return { expediente: { referidos: { some: { area: 'PSICOLOGIA' } } } };
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
export function expedienteAccesibleSql(_psicologaId: string): Prisma.Sql {
  void _psicologaId;
  return Prisma.sql`EXISTS (SELECT 1 FROM "ReferidoArea" x WHERE x."expedienteId" = e.id AND x.area = 'PSICOLOGIA')`;
}
