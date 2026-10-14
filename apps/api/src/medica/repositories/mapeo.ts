import type { Prisma } from '@prisma/client';
import {
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  type SignosVitalesDto,
} from '@akyuam/shared';

/** Las columnas de signos vitales, tal como se piden a Prisma. */
export const SELECT_SIGNOS = {
  presionSistolica: true,
  presionDiastolica: true,
  frecuenciaCardiaca: true,
  frecuenciaResp: true,
  temperaturaC: true,
  saturacionO2: true,
  glucosaMgDl: true,
  pesoKg: true,
  tallaM: true,
} as const;

type FilaSignos = {
  presionSistolica: number | null;
  presionDiastolica: number | null;
  frecuenciaCardiaca: number | null;
  frecuenciaResp: number | null;
  temperaturaC: Prisma.Decimal | null;
  saturacionO2: number | null;
  glucosaMgDl: number | null;
  pesoKg: Prisma.Decimal | null;
  tallaM: Prisma.Decimal | null;
};

function decimal(valor: Prisma.Decimal | null): number | null {
  return valor === null ? null : valor.toNumber();
}

export function signosDeFila(fila: FilaSignos): SignosVitalesDto {
  return {
    presionSistolica: fila.presionSistolica,
    presionDiastolica: fila.presionDiastolica,
    frecuenciaCardiaca: fila.frecuenciaCardiaca,
    frecuenciaResp: fila.frecuenciaResp,
    temperaturaC: decimal(fila.temperaturaC),
    saturacionO2: fila.saturacionO2,
    glucosaMgDl: fila.glucosaMgDl,
    pesoKg: decimal(fila.pesoKg),
    tallaM: decimal(fila.tallaM),
  };
}

/** Municipio de la usuaria para la ficha: el de Alta Verapaz o el que se escribió a mano. */
export function procedencia(usuaria: {
  municipio: keyof typeof ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ | null;
  municipioOtro: string | null;
  departamentoOtro: string | null;
}): string | null {
  if (usuaria.municipio) {
    return `${ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[usuaria.municipio]}, Alta Verapaz`;
  }
  const partes = [usuaria.municipioOtro, usuaria.departamentoOtro].filter(
    (parte): parte is string => !!parte,
  );
  return partes.length > 0 ? partes.join(', ') : null;
}

/** Cursor opaco de paginación: el instante y el id del último elemento de la página. */
export function codificarCursor(instante: Date, id: string): string {
  return Buffer.from(`${instante.toISOString()}|${id}`).toString('base64url');
}

export function decodificarCursor(
  cursor: string | undefined,
): { instante: Date; id: string } | null {
  if (!cursor) {
    return null;
  }
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const instante = new Date(iso ?? '');
  if (!id || Number.isNaN(instante.getTime())) {
    return null;
  }
  return { instante, id };
}
