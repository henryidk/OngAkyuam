import { Injectable } from '@nestjs/common';
import type { AgendaCita, CitaResumen, DocumentoCitaDto } from '@akyuam/shared';
import { ESTADOS_CITA_PSICOLOGICA, MODALIDADES_CITA } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AccesoCitaPsicologica,
  ActualizarCitaParams,
  CrearCitaParams,
  CrearDocumentoCitaParams,
  DocumentoCitaParaDescarga,
  ICitasPsicologicasRepository,
  RangoFechas,
  ReporteAgregado,
} from '../interfaces/citas-psicologicas-repository.interface';
import { INCLUDE_CITA, mapearCita } from './citas-psicologicas.mapper';

@Injectable()
export class CitasPsicologicasRepository implements ICitasPsicologicasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarAccesoCita(
    citaId: string,
  ): Promise<AccesoCitaPsicologica | null> {
    const cita = await this.prisma.citaPsicologica.findFirst({
      where: {
        id: citaId,
        atencion: {
          expediente: { referidos: { some: { area: 'PSICOLOGIA' } } },
        },
      },
      select: {
        id: true,
        atencionId: true,
        atencion: { select: { expedienteId: true } },
      },
    });
    if (!cita) return null;
    return {
      id: cita.id,
      atencionId: cita.atencionId,
      expedienteId: cita.atencion.expedienteId,
    };
  }

  async crear(params: CrearCitaParams): Promise<CitaResumen> {
    const cita = await this.prisma.citaPsicologica.create({
      data: {
        atencionId: params.atencionId,
        fechaHora: params.fechaHora,
        modalidad: params.modalidad,
        lugar: params.lugar,
        motivo: params.motivo,
        atendidoPorId: params.atendidoPorId,
      },
      include: INCLUDE_CITA,
    });
    return mapearCita(cita);
  }

  async actualizar(params: ActualizarCitaParams): Promise<CitaResumen> {
    const cita = await this.prisma.citaPsicologica.update({
      where: { id: params.citaId },
      data: {
        estado: params.estado,
        observaciones: params.observaciones,
        acuerdos: params.acuerdos,
      },
      include: INCLUDE_CITA,
    });
    return mapearCita(cita);
  }

  async crearDocumento(
    params: CrearDocumentoCitaParams,
  ): Promise<DocumentoCitaDto> {
    const documento = await this.prisma.documento.create({
      data: {
        expedienteId: params.expedienteId,
        tipo: 'FORMATO_ATENCION_PSICOLOGICA',
        nombreArchivo: params.nombreArchivo,
        claveR2: params.claveR2,
        mimeType: params.mimeType,
        tamanioBytes: params.tamanioBytes,
        subidoPorId: params.subidoPorId,
        citaPsicologicaId: params.citaId,
      },
    });
    return {
      id: documento.id,
      tipo: documento.tipo,
      nombreArchivo: documento.nombreArchivo,
      tamanioBytes: documento.tamanioBytes,
      createdAt: documento.createdAt.toISOString(),
    };
  }

  async buscarDocumentoParaDescarga(
    citaId: string,
  ): Promise<DocumentoCitaParaDescarga | null> {
    return this.prisma.documento.findFirst({
      where: { citaPsicologicaId: citaId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, claveR2: true, nombreArchivo: true },
    });
  }

  async listarAgenda(rango: RangoFechas): Promise<AgendaCita[]> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: {
        fechaHora: { gte: rango.desde, lte: rango.hasta },
        atencion: {
          expediente: { referidos: { some: { area: 'PSICOLOGIA' } } },
        },
      },
      include: {
        ...INCLUDE_CITA,
        atencion: {
          select: {
            expedienteId: true,
            expediente: {
              select: {
                usuaria: { select: { nombres: true, apellidos: true } },
              },
            },
          },
        },
      },
      orderBy: { fechaHora: 'asc' },
    });

    return citas.map((cita) => ({
      ...mapearCita(cita),
      expedienteId: cita.atencion.expedienteId,
      usuariaNombreCompleto: `${cita.atencion.expediente.usuaria.nombres} ${cita.atencion.expediente.usuaria.apellidos}`,
    }));
  }

  async obtenerReporte(rango: RangoFechas): Promise<ReporteAgregado> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: {
        fechaHora: { gte: rango.desde, lte: rango.hasta },
        atencion: {
          expediente: { referidos: { some: { area: 'PSICOLOGIA' } } },
        },
      },
      select: {
        estado: true,
        modalidad: true,
        atencion: { select: { expedienteId: true } },
      },
    });

    const porEstado = Object.fromEntries(
      ESTADOS_CITA_PSICOLOGICA.map((estado) => [estado, 0]),
    ) as ReporteAgregado['porEstado'];
    const porModalidad = Object.fromEntries(
      MODALIDADES_CITA.map((modalidad) => [modalidad, 0]),
    ) as ReporteAgregado['porModalidad'];

    const expedientesUnicos = new Set<string>();
    for (const cita of citas) {
      porEstado[cita.estado] += 1;
      porModalidad[cita.modalidad] += 1;
      expedientesUnicos.add(cita.atencion.expedienteId);
    }

    return {
      totalCitas: citas.length,
      porEstado,
      porModalidad,
      usuariasAtendidas: expedientesUnicos.size,
    };
  }
}
