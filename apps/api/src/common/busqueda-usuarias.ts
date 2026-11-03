import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formatoNumeroExpediente } from '@akyuam/shared';

/**
 * Búsqueda de usuarias compartida por las listas de Trabajo Social, Jurídico, Psicología y
 * Médica: el mismo cuadro "nombre, DPI o expediente" se interpreta igual en todas.
 */

const LONGITUD_MINIMA_BUSQUEDA_NOMBRE = 3;
const PATRON_NUMERO_EXPEDIENTE = /^(\d+)-(\d{4})(?:\.(\d+))?$/;
const PATRON_DPI = /^\d{13}$/;

/** Criterio de búsqueda ya interpretado a partir de `q`. */
export type BusquedaListaUsuarias =
  | {
      tipo: 'numeroExpediente';
      /** Siempre con el número del expediente ("05-2026"), aunque se haya buscado un hijo/a. */
      valor: string;
      /** Si se buscó el número de un hijo/a ("05-2026.01"): su consecutivo en el expediente. */
      ninoConsecutivo?: number;
    }
  | { tipo: 'dpi'; valor: string }
  | { tipo: 'nombre'; valor: string };

/**
 * Qué quiso buscar quien escribió `q` en la lista: número de expediente (acepta "5-2026" por
 * "05-2026") o de un hijo/a ("05-2026.01", que lleva a su madre), DPI exacto o nombre
 * (trigram, mínimo 3 letras).
 */
export function interpretarBusqueda(
  termino: string | undefined,
): BusquedaListaUsuarias | undefined {
  if (!termino) {
    return undefined;
  }
  const numero = PATRON_NUMERO_EXPEDIENTE.exec(termino);
  if (numero) {
    const valor = formatoNumeroExpediente(Number(numero[1]), Number(numero[2]));
    return numero[3]
      ? { tipo: 'numeroExpediente', valor, ninoConsecutivo: Number(numero[3]) }
      : { tipo: 'numeroExpediente', valor };
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
      return busqueda.ninoConsecutivo === undefined
        ? Prisma.sql`EXISTS (SELECT 1 FROM "Expediente" x WHERE x."usuariaId" = u.id AND x.numero = ${busqueda.valor})`
        : Prisma.sql`EXISTS (SELECT 1 FROM "Expediente" x JOIN "Nino" n ON n."expedienteId" = x.id
                     WHERE x."usuariaId" = u.id AND x.numero = ${busqueda.valor}
                       AND n.consecutivo = ${busqueda.ninoConsecutivo})`;
    case 'dpi':
      return Prisma.sql`u.dpi = ${busqueda.valor}`;
    // Mismo operador e índice trigram que la búsqueda por nombre de Trabajo Social.
    case 'nombre':
      return Prisma.sql`${busqueda.valor} <% (u.nombres || ' ' || u.apellidos)`;
  }
}
