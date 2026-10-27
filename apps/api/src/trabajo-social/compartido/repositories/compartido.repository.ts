import { Injectable } from '@nestjs/common';
import { etiquetaAtencion, etiquetaProcesoPsicologia } from '@akyuam/shared';
import type {
  ProcesoPsicologiaCompartidoDto,
  ResumenMedicoParaTs,
} from '@akyuam/shared';
import type { Rol } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  SELECT_SIGNOS,
  signosDeFila,
} from '../../../medica/repositories/mapeo';
import type {
  ICompartidoRepository,
  ProcesoJuridicoCompartido,
} from '../interfaces/compartido-repository.interface';

@Injectable()
export class CompartidoRepository implements ICompartidoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async areasReferidas(expedienteId: string): Promise<Rol[] | null> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id: expedienteId },
      select: { referidos: { select: { area: true } } },
    });
    return expediente
      ? expediente.referidos.map((referido) => referido.area)
      : null;
  }

  async procesosJuridicos(
    expedienteId: string,
  ): Promise<ProcesoJuridicoCompartido[]> {
    const procesos = await this.prisma.procesoJuridico.findMany({
      where: { expedienteId },
      orderBy: { fechaInicio: 'asc' },
      select: {
        tipo: true,
        fase: true,
        situacion: true,
        abogada: { select: { nombre: true } },
        procuradora: { select: { nombre: true } },
      },
    });
    return procesos.map((proceso) => ({
      tipo: proceso.tipo,
      fase: proceso.fase,
      situacion: proceso.situacion,
      abogada: proceso.abogada?.nombre ?? null,
      procuradora: proceso.procuradora?.nombre ?? null,
    }));
  }

  async procesosPsicologicos(
    expedienteId: string,
  ): Promise<ProcesoPsicologiaCompartidoDto[]> {
    const ahora = new Date();
    // `select` columna por columna: las notas de sesión, el motivo de cierre y el contenido de
    // las citas nunca salen de la base de datos por este camino.
    const procesos = await this.prisma.atencionPsicologica.findMany({
      where: { expedienteId, psicologaAsignadaId: { not: null } },
      orderBy: { consecutivo: 'asc' },
      select: {
        consecutivo: true,
        nino: { select: { consecutivo: true } },
        estado: true,
        fechaInicio: true,
        fechaCierre: true,
        expediente: { select: { numero: true } },
        citas: {
          select: {
            estado: true,
            fechaHora: true,
            documentos: {
              select: { id: true, tipo: true, createdAt: true },
            },
          },
          orderBy: { fechaHora: 'asc' },
        },
      },
    });

    // Primero los de la usuaria y luego los de cada hijo/a, cada persona en su orden.
    const porPersona = [...procesos].sort(
      (a, b) =>
        (a.nino?.consecutivo ?? 0) - (b.nino?.consecutivo ?? 0) ||
        a.consecutivo - b.consecutivo,
    );

    return porPersona.map((proceso) => {
      const proxima = proceso.citas.find(
        (cita) => cita.estado === 'PROGRAMADA' && cita.fechaHora >= ahora,
      );
      const documentos = proceso.citas
        .flatMap((cita) => cita.documentos)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return {
        codigo: etiquetaProcesoPsicologia(
          proceso.expediente.numero,
          proceso.consecutivo,
          proceso.nino?.consecutivo ?? null,
        ),
        etapa: proceso.estado,
        fechaInicio: proceso.fechaInicio?.toISOString() ?? null,
        fechaCierre: proceso.fechaCierre?.toISOString() ?? null,
        proximaCita: proxima?.fechaHora.toISOString() ?? null,
        documentos: documentos.map((documento) => ({
          id: documento.id,
          tipo: documento.tipo,
          subidoEn: documento.createdAt.toISOString(),
        })),
      };
    });
  }

  async atencionesMedicas(
    expedienteId: string,
  ): Promise<ResumenMedicoParaTs[]> {
    const ahora = new Date();
    // `select` columna por columna: diagnóstico, plan, receta, motivo de consulta y documentos
    // nunca salen de la base de datos por este camino.
    const atenciones = await this.prisma.atencionMedica.findMany({
      where: { expedienteId },
      orderBy: { consecutivo: 'asc' },
      select: {
        consecutivo: true,
        estado: true,
        expediente: { select: { numero: true } },
        consultas: {
          orderBy: { fechaHora: 'asc' },
          select: { fechaHora: true, ninoId: true, ...SELECT_SIGNOS },
        },
        citas: {
          where: { estado: 'PROGRAMADA', inicio: { gte: ahora } },
          orderBy: { inicio: 'asc' },
          take: 1,
          select: { inicio: true },
        },
      },
    });

    return atenciones.map((atencion) => {
      // Solo los de la usuaria: los de sus hijos/as no son parte de lo que se comparte.
      const ultimaDeUsuaria = atencion.consultas
        .filter((consulta) => consulta.ninoId === null)
        .at(-1);
      return {
        codigo: etiquetaAtencion(
          atencion.expediente.numero,
          atencion.consecutivo,
        ),
        estado: atencion.estado,
        fechasConsulta: atencion.consultas.map((consulta) =>
          consulta.fechaHora.toISOString(),
        ),
        proximaConsulta: atencion.citas[0]?.inicio.toISOString() ?? null,
        signosVitales: ultimaDeUsuaria
          ? {
              fecha: ultimaDeUsuaria.fechaHora.toISOString(),
              valores: signosDeFila(ultimaDeUsuaria),
            }
          : null,
      };
    });
  }
}
