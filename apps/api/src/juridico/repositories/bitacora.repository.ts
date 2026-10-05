import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EntradaBitacoraDto, TipoProcesoJuridico } from '@akyuam/shared';
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
    esSistema: entrada.esSistema,
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
          esSistema: params.esSistema,
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
      where: { id: entradaId, esSistema: true },
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

  // Se agrupa por la forma en minúsculas para que "Escrito" y "escrito" cuenten como uno; se
  // devuelve la escritura más reciente.
  async tiposUsadosEnProceso(
    procesoId: string,
    limite: number,
  ): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<{ tipo: string }[]>(Prisma.sql`
      SELECT (array_agg(n.tipo ORDER BY n."createdAt" DESC))[1] AS tipo
      FROM "NotaAvanceProceso" n
      WHERE n."procesoId" = ${procesoId} AND NOT n."esSistema"
      GROUP BY lower(n.tipo)
      ORDER BY max(n."createdAt") DESC
      LIMIT ${limite}
    `);
    return filas.map((fila) => fila.tipo);
  }

  async tiposMasUsadosPorTipoProceso(
    tipoProceso: TipoProcesoJuridico,
    limite: number,
  ): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<{ tipo: string }[]>(Prisma.sql`
      SELECT (array_agg(n.tipo ORDER BY n."createdAt" DESC))[1] AS tipo
      FROM "NotaAvanceProceso" n
      JOIN "ProcesoJuridico" p ON p.id = n."procesoId"
      WHERE p.tipo::text = ${tipoProceso} AND NOT n."esSistema"
      GROUP BY lower(n.tipo)
      ORDER BY count(*) DESC, max(n."createdAt") DESC
      LIMIT ${limite}
    `);
    return filas.map((fila) => fila.tipo);
  }
}
