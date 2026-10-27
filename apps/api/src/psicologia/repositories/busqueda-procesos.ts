import type { Prisma } from '@prisma/client';

/** Cada palabra debe aparecer en el número de expediente o en el nombre de la usuaria o del hijo/a. */
export function condicionBusqueda(
  palabras: string[],
): Prisma.AtencionPsicologicaWhereInput[] {
  const contiene = { mode: 'insensitive' as const };
  return palabras.map((palabra) => ({
    OR: [
      { expediente: { numero: { contains: palabra } } },
      {
        expediente: {
          usuaria: { nombres: { contains: palabra, ...contiene } },
        },
      },
      {
        expediente: {
          usuaria: { apellidos: { contains: palabra, ...contiene } },
        },
      },
      { nino: { nombres: { contains: palabra, ...contiene } } },
      { nino: { apellidos: { contains: palabra, ...contiene } } },
    ],
  }));
}
