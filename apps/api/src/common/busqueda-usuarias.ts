import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Búsqueda de usuarias compartida por las listas de Trabajo Social y de Jurídico: el mismo
 * cuadro "nombre, DPI o expediente" se interpreta igual en las dos.
 */

const LONGITUD_MINIMA_BUSQUEDA_NOMBRE = 3;
const PATRON_NUMERO_EXPEDIENTE = /^(\d{1,4})-(\d{4})$/;
const PATRON_DPI = /^\d{13}$/;

/** Criterio de búsqueda ya interpretado a partir de `q`. */
export type BusquedaListaUsuarias =
  | { tipo: 'numeroExpediente'; valor: string }
  | { tipo: 'dpi'; valor: string }
  | { tipo: 'nombre'; valor: string };

/**
 * Qué quiso buscar quien escribió `q` en la lista: número de expediente (acepta "5-2026" por
 * "05-2026"), DPI exacto o nombre (trigram, mínimo 3 letras).
 */
export function interpretarBusqueda(
  termino: string | undefined,
): BusquedaListaUsuarias | undefined {
  if (!termino) {
    return undefined;
  }
  const numero = PATRON_NUMERO_EXPEDIENTE.exec(termino);
  if (numero) {
    return {
      tipo: 'numeroExpediente',
      valor: `${numero[1].padStart(2, '0')}-${numero[2]}`,
    };
  }
  if (PATRON_DPI.test(termino)) {
    return { tipo: 'dpi', valor: termino };
  }
  if (termino.length < LONGITUD_MINIMA_BUSQUEDA_NOMBRE) {
    throw new BadRequestException(
      `Escribe al menos ${LONGITUD_MINIMA_BUSQUEDA_NOMBRE} letras, un DPI o un número de expediente`,
    );
  }
  return { tipo: 'nombre', valor: termino };
}

/** Condición SQL sobre la tabla `"Usuaria"` con alias `u`. */
export function condicionBusqueda(
  busqueda: BusquedaListaUsuarias | undefined,
): Prisma.Sql {
  if (!busqueda) {
    return Prisma.sql`TRUE`;
  }
  switch (busqueda.tipo) {
    // Cualquier caso de la usuaria, no solo el activo: quien busca por número puede traer el
    // de un caso anterior en la mano.
    case 'numeroExpediente':
      return Prisma.sql`EXISTS (SELECT 1 FROM "Expediente" x WHERE x."usuariaId" = u.id AND x.numero = ${busqueda.valor})`;
    case 'dpi':
      return Prisma.sql`u.dpi = ${busqueda.valor}`;
    // Mismo operador e índice trigram que la búsqueda por nombre de Trabajo Social.
    case 'nombre':
      return Prisma.sql`${busqueda.valor} <% (u.nombres || ' ' || u.apellidos)`;
  }
}
