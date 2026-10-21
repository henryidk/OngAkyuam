import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  finDiaGT,
  inicioDiaGT,
  type AsumirCitaPsicologicaInput,
  type CitasPsicologiaDto,
  type CitasPsicologiaQuery,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { codigoProceso } from '../dominio/codigo-proceso';
import {
  nombreCompleto,
  numeroPersona,
  personaAtendida,
  SELECT_PERSONA,
} from './personas';

const POR_PAGINA = 20;

@Injectable()
export class CitasEquipoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: CitasPsicologiaQuery,
    usuarioId: string,
  ): Promise<CitasPsicologiaDto> {
    const where: Prisma.CitaPsicologicaWhereInput = {
      fechaHora: { gte: inicioDiaGT(query.desde), lte: finDiaGT(query.hasta) },
      estado: query.estado,
      atencion: { expediente: { referidos: { some: { area: 'PSICOLOGIA' } } } },
      ...(query.soloMios
        ? {
            OR: [
              { atendidoPorId: usuarioId },
              { atencion: { psicologaAsignadaId: usuarioId } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const grupos = await tx.citaPsicologica.groupBy({
          by: ['estado', 'tipo'],
          where,
          _count: true,
        });
        const citas = await tx.citaPsicologica.findMany({
          where,
          orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
          skip: (query.pagina - 1) * POR_PAGINA,
          take: POR_PAGINA,
          select: {
            id: true,
            fechaHora: true,
            duracionMinutos: true,
            tipo: true,
            estado: true,
            borrador: true,
            lugar: true,
            atendidoPor: { select: { id: true, nombreCompleto: true } },
            nino: {
              select: { id: true, consecutivo: true, ...SELECT_PERSONA },
            },
            atencion: {
              select: {
                id: true,
                consecutivo: true,
                psicologaAsignada: {
                  select: { id: true, nombreCompleto: true },
                },
                expediente: {
                  select: {
                    numero: true,
                    usuaria: { select: { id: true, ...SELECT_PERSONA } },
                  },
                },
              },
            },
          },
        });
        return {
          pagina: query.pagina,
          porPagina: POR_PAGINA,
          total: grupos.reduce((n, g) => n + g._count, 0),
          atendidas: grupos
            .filter((g) => g.estado === 'ATENDIDA')
            .reduce((n, g) => n + g._count, 0),
          primerasAtenciones: grupos
            .filter(
              (g) => g.estado === 'ATENDIDA' && g.tipo === 'PRIMERA_ATENCION',
            )
            .reduce((n, g) => n + g._count, 0),
          ausencias: grupos
            .filter((g) => g.estado === 'NO_ASISTIO')
            .reduce((n, g) => n + g._count, 0),
          items: citas.map((c) => ({
            id: c.id,
            procesoId: c.atencion.id,
            procesoCodigo: codigoProceso(
              c.atencion.consecutivo,
              numeroPersona(c.atencion.expediente.numero, c.nino),
            ),
            usuariaId: c.atencion.expediente.usuaria.id,
            usuariaNombreCompleto: nombreCompleto(
              c.atencion.expediente.usuaria,
            ),
            persona: personaAtendida(c.atencion.expediente.usuaria, c.nino),
            fechaHora: c.fechaHora.toISOString(),
            duracionMinutos: c.duracionMinutos,
            tipo: c.tipo,
            estado: c.estado,
            sinRegistrar: false,
            borrador: c.borrador,
            clinica: c.lugar,
            profesional: {
              id: c.atendidoPor.id,
              nombre: c.atendidoPor.nombreCompleto,
            },
            responsable: c.atencion.psicologaAsignada
              ? {
                  id: c.atencion.psicologaAsignada.id,
                  nombre: c.atencion.psicologaAsignada.nombreCompleto,
                }
              : null,
            propia: c.atendidoPor.id === usuarioId,
          })),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  // Bloquea el proceso antes de la cita, igual que registrar/cerrar/reprogramar.
  // La comparación con lo que vio la usuaria evita apropiarse de una cita que cambió entre pestañas.
  asumir(
    citaId: string,
    usuarioId: string,
    datos: AsumirCitaPsicologicaInput,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const cita = await tx.citaPsicologica.findUnique({
        where: { id: citaId },
        select: { atencionId: true },
      });
      if (!cita) return false;
      const abierto = await tx.atencionPsicologica.updateMany({
        where: {
          id: cita.atencionId,
          psicologaAsignadaId: datos.psicologaAsignadaId,
          estado: { not: 'CIERRE' },
          expediente: { referidos: { some: { area: 'PSICOLOGIA' } } },
        },
        data: { version: { increment: 0 } },
      });
      if (abierto.count !== 1) return false;
      const cambiada = await tx.citaPsicologica.updateMany({
        where: {
          id: citaId,
          atendidoPorId: datos.profesionalCitaId,
          estado: 'PROGRAMADA',
          borrador: false,
          documentos: { none: {} },
          temas: null,
          intervencion: null,
          recomendaciones: null,
          acuerdos: null,
          observaciones: null,
          enfoqueTerapeutico: null,
        },
        data: { atendidoPorId: usuarioId },
      });
      return cambiada.count === 1;
    });
  }
}
