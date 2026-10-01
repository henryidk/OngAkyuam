import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { EntradaBitacoraDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IBitacoraRepository,
  RegistrarEntradaParams,
} from '../interfaces/bitacora-repository.interface';

/** Tope de entradas que viajan con el detalle del proceso. */
const MAXIMO_ENTRADAS = 200;

const INCLUDE_AUTOR = {
  registradoPor: { select: { nombreCompleto: true } },
} satisfies Prisma.NotaAvanceProcesoInclude;

type EntradaConAutor = Prisma.NotaAvanceProcesoGetPayload<{
  include: typeof INCLUDE_AUTOR;
}>;

function mapearEntrada(entrada: EntradaConAutor): EntradaBitacoraDto {
  return {
    id: entrada.id,
    tipo: entrada.tipo,
    contenido: entrada.contenido,
    registradoPor: entrada.registradoPor.nombreCompleto,
    createdAt: entrada.createdAt.toISOString(),
  };
}

@Injectable()
export class BitacoraRepository implements IBitacoraRepository {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(params: RegistrarEntradaParams): Promise<EntradaBitacoraDto> {
    const [entrada] = await this.prisma.$transaction([
      this.prisma.notaAvanceProceso.create({
        data: {
          procesoId: params.procesoId,
          tipo: params.tipo,
          contenido: params.contenido,
          registradoPorId: params.registradoPorId,
        },
        include: INCLUDE_AUTOR,
      }),
      // Sin tocar `version`: anotar una actuación no debe invalidar un formulario de datos
      // que otra persona tenga abierto sobre el mismo proceso.
      this.prisma.procesoJuridico.update({
        where: { id: params.procesoId },
        data: { ultimaActuacionEn: new Date() },
        select: { id: true },
      }),
    ]);
    return mapearEntrada(entrada);
  }

  async actualizarContenido(
    entradaId: string,
    contenido: string,
  ): Promise<void> {
    await this.prisma.notaAvanceProceso.updateMany({
      where: { id: entradaId, tipo: 'SISTEMA' },
      data: { contenido },
    });
  }

  async listarPorProceso(procesoId: string): Promise<EntradaBitacoraDto[]> {
    const entradas = await this.prisma.notaAvanceProceso.findMany({
      where: { procesoId },
      include: INCLUDE_AUTOR,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAXIMO_ENTRADAS,
    });
    return entradas.map(mapearEntrada);
  }
}
