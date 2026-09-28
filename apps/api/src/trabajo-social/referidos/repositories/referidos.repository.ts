import { Injectable } from '@nestjs/common';
import { Prisma, type Rol } from '@prisma/client';
import { fechaColumnaISO, type ProfesionalArea } from '@akyuam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AreaYaReferidaError,
  type CrearReferidoParams,
  type ExpedienteParaReferir,
  type IReferidosRepository,
  type ReferidoRegistrado,
} from '../interfaces/referidos-repository.interface';

@Injectable()
export class ReferidosRepository implements IReferidosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarExpediente(
    expedienteId: string,
  ): Promise<ExpedienteParaReferir | null> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id: expedienteId },
      include: {
        usuaria: {
          select: { nombres: true, apellidos: true, municipio: true },
        },
        referidos: { select: { area: true } },
      },
    });
    if (!expediente) {
      return null;
    }
    return {
      id: expediente.id,
      numero: expediente.numero,
      fecha: fechaColumnaISO(expediente.fecha),
      municipio: expediente.usuaria.municipio,
      tipoRegistro: expediente.tipoRegistro,
      usuariaNombreCompleto: `${expediente.usuaria.nombres} ${expediente.usuaria.apellidos}`,
      areasReferidas: expediente.referidos.map((referido) => referido.area),
    };
  }

  async esProfesionalActivoDelArea(
    usuarioId: string,
    area: Rol,
  ): Promise<boolean> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, rol: area, isActive: true },
      select: { id: true },
    });
    return usuario !== null;
  }

  async listarProfesionales(area: Rol): Promise<ProfesionalArea[]> {
    return this.prisma.usuario.findMany({
      where: { rol: area, isActive: true },
      select: { id: true, nombreCompleto: true, puesto: true },
      orderBy: { nombreCompleto: 'asc' },
    });
  }

  async crear(params: CrearReferidoParams): Promise<ReferidoRegistrado> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const referido = await tx.referidoArea.create({
          data: {
            expedienteId: params.expedienteId,
            area: params.area,
            prioridad: params.prioridad,
            motivo: params.motivo,
            profesionalAsignadoId: params.profesionalAsignadoId,
            puedeVerDatosCaso: params.puedeVerDatosCaso,
            otorgadoPorId: params.otorgadoPorId,
          },
        });

        if (params.documentosVisibles.length > 0) {
          const vigentes = await tx.documento.findMany({
            where: {
              expedienteId: params.expedienteId,
              vigente: true,
              tipo: { in: params.documentosVisibles },
            },
            select: { id: true },
          });
          await tx.documentoVisibilidadArea.createMany({
            data: vigentes.map((documento) => ({
              documentoId: documento.id,
              area: params.area,
              otorgadoPorId: params.otorgadoPorId,
            })),
            skipDuplicates: true,
          });
        }

        if (params.crearAtencionPsicologica && params.profesionalAsignadoId) {
          await tx.atencionPsicologica.create({
            data: {
              expedienteId: params.expedienteId,
              psicologaAsignadaId: params.profesionalAsignadoId,
              tomadaEn: new Date(),
              actualizadoPorId: params.otorgadoPorId,
            },
          });
        }

        return {
          id: referido.id,
          area: referido.area,
          prioridad: referido.prioridad,
          profesionalAsignadoId: referido.profesionalAsignadoId,
          createdAt: referido.createdAt,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[] | undefined)?.includes('area')
      ) {
        throw new AreaYaReferidaError();
      }
      throw error;
    }
  }
}
