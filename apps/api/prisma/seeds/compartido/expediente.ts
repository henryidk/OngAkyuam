import type { Prisma } from '@prisma/client';
import { formatoNumeroExpediente } from '@akyuam/shared';

/**
 * Siguiente número de expediente del año, con el mismo contador y el mismo formato que usa el
 * sistema al registrar un caso: así los seeds no chocan con los expedientes creados después.
 */
export async function siguienteNumeroExpediente(
  tx: Prisma.TransactionClient,
  anio: number,
): Promise<string> {
  const contador = await tx.expedienteContador.upsert({
    where: { anio },
    create: { anio, ultimo: 1 },
    update: { ultimo: { increment: 1 } },
  });
  return formatoNumeroExpediente(contador.ultimo, anio);
}
