import { Prisma } from '@prisma/client';

// Quién puede qué en Psicología (planpsicologiaequipo.md):
// - LEER es de toda el área: cualquier cuenta de Psicología ve lo de un expediente que Trabajo
//   Social refirió a Psicología (usuarias, procesos abiertos y cerrados, sesiones y documentos).
// - GESTIONAR un proceso (programar, reprogramar, cerrar, visibilidad) es de su responsable.
// - REGISTRAR o corregir una sesión es de quien la atendió.
// Cada regla tiene, si hace falta, su forma Prisma y su forma SQL: si cambia una, cambia la otra.

/** Expediente que Trabajo Social refirió a Psicología: toda el área lo puede leer. */
export const EXPEDIENTE_DE_PSICOLOGIA = {
  referidos: { some: { area: 'PSICOLOGIA' } },
} satisfies Prisma.ExpedienteWhereInput;

/** Proceso que cualquier cuenta de Psicología puede leer. Nunca autoriza una escritura. */
export const PROCESO_LEGIBLE = {
  expediente: EXPEDIENTE_DE_PSICOLOGIA,
} satisfies Prisma.AtencionPsicologicaWhereInput;

/** Referencia "sin tomar": ninguna psicóloga se ha hecho cargo de un proceso en ese expediente. */
export const EXPEDIENTE_SIN_TOMAR = {
  atencionesPsicologicas: { none: { psicologaAsignadaId: { not: null } } },
} satisfies Prisma.ExpedienteWhereInput;

/** Expediente referido que alguien del área ya tomó: ahí se abren procesos desde la ficha. */
export const EXPEDIENTE_TOMADO = {
  ...EXPEDIENTE_DE_PSICOLOGIA,
  atencionesPsicologicas: { some: { psicologaAsignadaId: { not: null } } },
} satisfies Prisma.ExpedienteWhereInput;

/** Proceso que esta psicóloga gestiona: es su responsable. */
export function procesoGestionable(
  psicologaId: string,
): Prisma.AtencionPsicologicaWhereInput {
  return { psicologaAsignadaId: psicologaId, ...PROCESO_LEGIBLE };
}

/**
 * Cita cuya sesión esta psicóloga puede registrar o corregir: la atendió (o la tiene asignada)
 * ella y el proceso sigue abierto. No exige ser la responsable del proceso.
 */
export function citaRegistrable(
  psicologaId: string,
): Prisma.CitaPsicologicaWhereInput {
  return {
    atendidoPorId: psicologaId,
    atencion: { estado: { not: 'CIERRE' }, ...PROCESO_LEGIBLE },
  };
}

/**
 * Sesiones mías que ya empezaron y siguen sin registrar, en procesos abiertos: lo que lista
 * Consultas › Por registrar y cuenta su insignia. Misma regla que "No asistió".
 */
export function sesionPorRegistrar(
  psicologaId: string,
  ahora: Date,
): Prisma.CitaPsicologicaWhereInput {
  return {
    ...citaRegistrable(psicologaId),
    estado: 'PROGRAMADA',
    fechaHora: { lte: ahora },
  };
}

/**
 * Proceso sin cerrar de una persona: la usuaria (en cualquiera de sus expedientes) o un hijo/a.
 * Sostiene "un solo proceso abierto por persona"; la base lo garantiza dentro de un expediente
 * y esta condición lo cubre entre expedientes de la misma usuaria.
 */
export function procesoAbiertoDePersona(persona: {
  usuariaId: string;
  ninoId: string | null;
}): Prisma.AtencionPsicologicaWhereInput {
  return persona.ninoId === null
    ? {
        estado: { not: 'CIERRE' },
        ninoId: null,
        expediente: { usuariaId: persona.usuariaId },
      }
    : { estado: { not: 'CIERRE' }, ninoId: persona.ninoId };
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

/** `EXPEDIENTE_DE_PSICOLOGIA` sobre el alias `e` de "Expediente". */
export const EXPEDIENTE_DE_PSICOLOGIA_SQL = Prisma.sql`EXISTS (
  SELECT 1 FROM "ReferidoArea" x
  WHERE x."expedienteId" = e.id AND x.area = 'PSICOLOGIA'
)`;
