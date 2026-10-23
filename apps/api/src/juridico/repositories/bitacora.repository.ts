import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { EntradaBitacoraDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IBitacoraRepository,
  RegistrarEntradaParams,
} from '../interfaces/bitacora-repository.interface';
import { INCLUDE_DOCUMENTO, mapearDocumento } from './mapeo-documento';

/** Tope de entradas que viajan con el detalle del proceso. */
const MAXIMO_ENTRADAS = 200;

const INCLUDE_ENTRADA = {
  registradoPor: { select: { nombreCompleto: true } },
  documentos: {
    include: INCLUDE_DOCUMENTO,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.NotaAvanceProcesoInclude;

type EntradaConRelaciones = Prisma.NotaAvanceProcesoGetPayload<{
  include: typeof INCLUDE_ENTRADA;
}>;

function mapearEntrada(entrada: EntradaConRelaciones): EntradaBitacoraDto {
  return {
    id: entrada.id,
    tipo: entrada.tipo,
    esSistema: entrada.esSistema,
    contenido: entrada.contenido,
    registradoPor: entrada.registradoPor.nombreCompleto,
    createdAt: entrada.createdAt.toISOString(),
    documentos: entrada.documentos.map(mapearDocumento),
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
          esSistema: params.esSistema,
          contenido: params.contenido,
          registradoPorId: params.registradoPorId,
        },
        include: INCLUDE_ENTRADA,
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
      where: { id: entradaId, esSistema: true },
      data: { contenido },
    });
  }

  async listarPorProceso(procesoId: string): Promise<EntradaBitacoraDto[]> {
    const entradas = await this.prisma.notaAvanceProceso.findMany({
      where: { procesoId },
      include: INCLUDE_ENTRADA,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAXIMO_ENTRADAS,
    });
    return entradas.map(mapearEntrada);
  }

  async buscarEnProceso(
    entradaId: string,
    procesoId: string,
  ): Promise<{ esSistema: boolean } | null> {
    return this.prisma.notaAvanceProceso.findFirst({
      where: { id: entradaId, procesoId },
      select: { esSistema: true },
    });
  }
}
