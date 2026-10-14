import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AccesoAtencionMedica,
  AccesoCitaMedica,
  AccesoConsultaMedica,
  AccesoDocumentoMedico,
  AccesoExpedienteMedica,
  AccesoReferenciaMedica,
  IAccesoMedicaRepository,
} from '../interfaces/acceso-medica-repository.interface';

/** Condición única de acceso: el expediente tiene una referencia de Trabajo Social a Medicina. */
export const EXPEDIENTE_REFERIDO_A_MEDICA = {
  referidos: { some: { area: 'MEDICA' } },
} satisfies Prisma.ExpedienteWhereInput;

const SELECT_EXPEDIENTE = {
  id: true,
  numero: true,
  usuariaId: true,
} as const;

const SELECT_ATENCION = {
  id: true,
  consecutivo: true,
  estado: true,
  version: true,
  expediente: { select: SELECT_EXPEDIENTE },
} as const;

function expediente(e: {
  id: string;
  numero: string;
  usuariaId: string;
}): AccesoExpedienteMedica {
  return {
    expedienteId: e.id,
    expedienteNumero: e.numero,
    usuariaId: e.usuariaId,
  };
}

@Injectable()
export class AccesoMedicaRepository implements IAccesoMedicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarExpediente(
    expedienteId: string,
  ): Promise<AccesoExpedienteMedica | null> {
    const encontrado = await this.prisma.expediente.findFirst({
      where: { id: expedienteId, ...EXPEDIENTE_REFERIDO_A_MEDICA },
      select: SELECT_EXPEDIENTE,
    });
    return encontrado ? expediente(encontrado) : null;
  }

  async buscarReferencia(
    referidoId: string,
  ): Promise<AccesoReferenciaMedica | null> {
    const referencia = await this.prisma.referidoArea.findFirst({
      where: { id: referidoId, area: 'MEDICA' },
      select: { id: true, expediente: { select: SELECT_EXPEDIENTE } },
    });
    return referencia
      ? { referidoId: referencia.id, ...expediente(referencia.expediente) }
      : null;
  }

  async buscarAtencion(
    atencionId: string,
  ): Promise<AccesoAtencionMedica | null> {
    const atencion = await this.prisma.atencionMedica.findFirst({
      where: { id: atencionId, expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      select: SELECT_ATENCION,
    });
    return atencion ? this.aAtencion(atencion) : null;
  }

  async buscarCita(citaId: string): Promise<AccesoCitaMedica | null> {
    const cita = await this.prisma.citaMedica.findFirst({
      where: {
        id: citaId,
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: {
        id: true,
        ninoId: true,
        inicio: true,
        duracionMin: true,
        estado: true,
        version: true,
        consulta: { select: { id: true } },
        reprogramadaA: { select: { id: true } },
        atencion: { select: SELECT_ATENCION },
      },
    });
    if (!cita) {
      return null;
    }
    return {
      ...this.aAtencion(cita.atencion),
      citaId: cita.id,
      ninoId: cita.ninoId,
      inicio: cita.inicio,
      duracionMin: cita.duracionMin,
      estadoCita: cita.estado,
      versionCita: cita.version,
      consultaId: cita.consulta?.id ?? null,
      reprogramadaAId: cita.reprogramadaA?.id ?? null,
    };
  }

  async buscarConsulta(
    consultaId: string,
  ): Promise<AccesoConsultaMedica | null> {
    const consulta = await this.prisma.consultaMedica.findFirst({
      where: {
        id: consultaId,
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: { id: true, atencion: { select: SELECT_ATENCION } },
    });
    return consulta
      ? { ...this.aAtencion(consulta.atencion), consultaId: consulta.id }
      : null;
  }

  async buscarDocumento(
    documentoId: string,
  ): Promise<AccesoDocumentoMedico | null> {
    const documento = await this.prisma.documentoMedico.findFirst({
      where: {
        id: documentoId,
        consulta: { atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA } },
      },
      select: {
        id: true,
        claveObjeto: true,
        nombreArchivo: true,
        mimeType: true,
        consulta: {
          select: {
            atencion: { select: { expediente: { select: SELECT_EXPEDIENTE } } },
          },
        },
      },
    });
    if (!documento) {
      return null;
    }
    return {
      ...expediente(documento.consulta.atencion.expediente),
      documentoId: documento.id,
      claveObjeto: documento.claveObjeto,
      nombreArchivo: documento.nombreArchivo,
      mimeType: documento.mimeType,
    };
  }

  async usuariaReferida(usuariaId: string): Promise<boolean> {
    const encontrado = await this.prisma.expediente.findFirst({
      where: { usuariaId, ...EXPEDIENTE_REFERIDO_A_MEDICA },
      select: { id: true },
    });
    return encontrado !== null;
  }

  async ninoPerteneceAExpediente(
    ninoId: string,
    expedienteId: string,
  ): Promise<boolean> {
    const nino = await this.prisma.nino.findFirst({
      where: { id: ninoId, expedienteId },
      select: { id: true },
    });
    return nino !== null;
  }

  private aAtencion(atencion: {
    id: string;
    consecutivo: number;
    estado: AccesoAtencionMedica['estado'];
    version: number;
    expediente: { id: string; numero: string; usuariaId: string };
  }): AccesoAtencionMedica {
    return {
      ...expediente(atencion.expediente),
      atencionId: atencion.id,
      consecutivo: atencion.consecutivo,
      estado: atencion.estado,
      version: atencion.version,
    };
  }
}
