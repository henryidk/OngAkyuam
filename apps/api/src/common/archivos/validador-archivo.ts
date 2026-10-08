import { NOMBRE_DOCUMENTO_MAX, mimeTypePermitido } from '@akyuam/shared';

export type MotivoArchivoInvalido =
  'VACIO' | 'TIPO_NO_PERMITIDO' | 'CONTENIDO_NO_COINCIDE';

export interface ArchivoAValidar {
  mimeType: string;
  contenido: Buffer;
}

type Firma = (contenido: Buffer) => boolean;

const empiezaCon =
  (...bytes: number[]): Firma =>
  (contenido) =>
    contenido.length >= bytes.length &&
    bytes.every((byte, posicion) => contenido[posicion] === byte);

// Los primeros bytes de cada formato permitido. El tipo que declara el navegador lo escribe
// quien sube el archivo; estos bytes son lo que el archivo realmente es.
const FIRMAS: Record<string, Firma> = {
  'application/pdf': empiezaCon(0x25, 0x50, 0x44, 0x46, 0x2d), // %PDF-
  'image/jpeg': empiezaCon(0xff, 0xd8, 0xff),
  'image/png': empiezaCon(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  'image/webp': (contenido) =>
    contenido.length >= 12 &&
    contenido.toString('latin1', 0, 4) === 'RIFF' &&
    contenido.toString('latin1', 8, 12) === 'WEBP',
};

/** `null` si el archivo se puede guardar. Función pura: sin Nest, sin disco, sin red. */
export function validarArchivo(
  archivo: ArchivoAValidar,
): MotivoArchivoInvalido | null {
  if (archivo.contenido.length === 0) {
    return 'VACIO';
  }
  const firma = FIRMAS[archivo.mimeType];
  if (!mimeTypePermitido(archivo.mimeType) || !firma) {
    return 'TIPO_NO_PERMITIDO';
  }
  return firma(archivo.contenido) ? null : 'CONTENIDO_NO_COINCIDE';
}

// eslint-disable-next-line no-control-regex -- quitar esos caracteres es justo el propósito
const CARACTERES_DE_CONTROL = /[\u0000-\u001f\u007f]/g;

/**
 * El nombre que verá el equipo. Si no se escribió uno, sale del nombre del archivo sin su
 * extensión. Nunca se usa para armar la clave de almacenamiento.
 */
export function resolverNombreVisible(
  nombreVisible: string | undefined,
  nombreArchivo: string,
): string {
  const limpio = (texto: string) =>
    texto.replace(CARACTERES_DE_CONTROL, '').trim();

  const elegido =
    limpio(nombreVisible ?? '') ||
    limpio(nombreArchivo.replace(/\.[^.]*$/, '')) ||
    'Documento';
  return elegido.slice(0, NOMBRE_DOCUMENTO_MAX).trim();
}
