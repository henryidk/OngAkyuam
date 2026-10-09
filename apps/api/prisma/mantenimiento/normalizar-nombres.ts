/**
 * Corrige las mayúsculas y los espacios de los nombres ya guardados (usuarias, hijos/as y
 * agresores), con la misma regla que Trabajo Social aplica al guardar: "angie  trinidad" →
 * "Angie Trinidad". Los registros nuevos ya entran normalizados; esto es solo para los anteriores.
 *
 * Solo se corre a mano, nunca en un despliegue ni al arrancar el contenedor.
 *  - Sin argumentos es una SIMULACIÓN: cuenta lo que cambiaría y no escribe nada.
 *  - Para escribir hacen falta las dos banderas: `--aplicar --confirmo-respaldo`. La segunda es
 *    la confirmación de que ya existe un respaldo de la base tomado justo antes.
 *  - Es idempotente: una fila que ya está bien escrita no se toca, así que repetirlo no hace nada.
 *  - No borra filas ni columnas. Todos los cambios van en una sola transacción: o entran todos o ninguno.
 *  - Nunca imprime nombres: solo cantidades e identificadores.
 *
 * Uso, desde apps/api:
 *   npx ts-node prisma/mantenimiento/normalizar-nombres.ts
 *   npx ts-node prisma/mantenimiento/normalizar-nombres.ts --aplicar --confirmo-respaldo
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { normalizarNombrePropio } from '@akyuam/shared';

const prisma = new PrismaClient();

interface FilaConNombre {
  id: string;
  nombres: string | null;
  apellidos: string | null;
}

interface Correccion {
  id: string;
  nombres: string | null;
  apellidos: string | null;
}

function normalizado(valor: string | null): string | null {
  return valor === null ? null : normalizarNombrePropio(valor);
}

/** Las filas cuyo nombre o apellido quedaría distinto, ya con el valor corregido. */
function correccionesDe(filas: FilaConNombre[]): Correccion[] {
  return filas
    .map((fila) => ({
      id: fila.id,
      nombres: normalizado(fila.nombres),
      apellidos: normalizado(fila.apellidos),
      cambia:
        normalizado(fila.nombres) !== fila.nombres ||
        normalizado(fila.apellidos) !== fila.apellidos,
    }))
    .filter((fila) => fila.cambia)
    .map(({ id, nombres, apellidos }) => ({ id, nombres, apellidos }));
}

const SELECCION = { id: true, nombres: true, apellidos: true } as const;

async function main() {
  const argumentos = new Set(process.argv.slice(2));
  const aplicar = argumentos.has('--aplicar');
  if (aplicar && !argumentos.has('--confirmo-respaldo')) {
    throw new Error(
      'Para escribir hace falta un respaldo previo de la base. Cuando lo tengas, agrega --confirmo-respaldo.',
    );
  }

  const usuarias = correccionesDe(
    await prisma.usuaria.findMany({ select: SELECCION }),
  );
  const ninos = correccionesDe(
    await prisma.nino.findMany({ select: SELECCION }),
  );
  const agresores = correccionesDe(
    await prisma.agresor.findMany({ select: SELECCION }),
  );

  const resumen = {
    usuarias: usuarias.length,
    ninos: ninos.length,
    agresores: agresores.length,
  };
  console.log(
    aplicar ? 'Filas a corregir:' : 'SIMULACIÓN. Filas que se corregirían:',
  );
  console.log(resumen);
  console.log(
    'Identificadores de usuarias:',
    usuarias.map((u) => u.id),
  );
  console.log(
    'Identificadores de hijos/as:',
    ninos.map((n) => n.id),
  );
  console.log(
    'Identificadores de agresores:',
    agresores.map((a) => a.id),
  );

  if (!aplicar) {
    console.log(
      'No se escribió nada. Para aplicar: --aplicar --confirmo-respaldo',
    );
    return;
  }

  const cambios: Prisma.PrismaPromise<unknown>[] = [
    ...usuarias.map(({ id, nombres, apellidos }) =>
      prisma.usuaria.update({
        where: { id },
        // En Usuaria los nombres son obligatorios: nunca llegan nulos.
        data: { nombres: nombres ?? '', apellidos: apellidos ?? '' },
      }),
    ),
    ...ninos.map(({ id, nombres, apellidos }) =>
      prisma.nino.update({
        where: { id },
        data: { nombres: nombres ?? '', apellidos: apellidos ?? '' },
      }),
    ),
    ...agresores.map(({ id, nombres, apellidos }) =>
      prisma.agresor.update({ where: { id }, data: { nombres, apellidos } }),
    ),
    // La bitácora guarda cuántas filas se tocaron, nunca los nombres.
    prisma.auditLog.create({
      data: {
        accion: 'NOMBRES_NORMALIZADOS',
        entidad: 'Mantenimiento',
        detalles: resumen,
      },
    }),
  ];
  await prisma.$transaction(cambios);
  console.log('Listo. Cambios aplicados.');
}

main()
  .catch((error: unknown) => {
    // Solo el tipo de error: el mensaje completo de Prisma puede traer valores de las filas.
    const esDePrisma = error instanceof Prisma.PrismaClientKnownRequestError;
    const esPropio = error instanceof Error && error.constructor === Error;
    console.error(
      esDePrisma
        ? `Error de base de datos ${error.code}. No se aplicó ningún cambio.`
        : esPropio
          ? error.message
          : 'Error inesperado. No se aplicó ningún cambio.',
    );
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
