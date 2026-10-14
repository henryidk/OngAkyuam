import { Injectable } from '@nestjs/common';
import { fechaCalendarioGT } from '@akyuam/shared';
import type {
  DocumentoMedicoDto,
  DocumentoMedicoSubidoDto,
  TipoDocumentoMedico,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { nombreCompleto } from '../../psicologia/repositories/personas';
import type {
  ArchivoMedicoGuardado,
  CrearPendienteParams,
  IDocumentosMedicosRepository,
  PendienteMedico,
} from '../interfaces/documentos-medicos-repository.interface';
import { EXPEDIENTE_REFERIDO_A_MEDICA } from './acceso-medica.repository';

/** Lo que se devuelve al subir: nunca la clave del objeto. */
const SELECT_SUBIDO = {
  id: true,
  tipo: true,
  nombreVisible: true,
  nombreArchivo: true,
  tamanioBytes: true,
} as const;

const SELECT_PENDIENTE = {
  id: true,
  claveObjeto: true,
  atencionId: true,
} as const;

@Injectable()
export class DocumentosMedicosRepository implements IDocumentosMedicosRepository {
  constructor(private readonly prisma: PrismaService) {}

  crearPendiente(
    params: CrearPendienteParams,
  ): Promise<DocumentoMedicoSubidoDto> {
    return this.prisma.documentoMedicoPendiente.create({
      data: params,
      select: SELECT_SUBIDO,
    });
  }

  buscarPendiente(
    id: string,
    subidoPorId: string,
  ): Promise<PendienteMedico | null> {
    return this.prisma.documentoMedicoPendiente.findFirst({
      where: { id, subidoPorId },
      select: SELECT_PENDIENTE,
    });
  }

  cambiarTipoPendiente(
    id: string,
    tipo: TipoDocumentoMedico,
  ): Promise<DocumentoMedicoSubidoDto> {
    return this.prisma.documentoMedicoPendiente.update({
      where: { id },
      data: { tipo },
      select: SELECT_SUBIDO,
    });
  }

  async eliminarPendiente(id: string): Promise<void> {
    await this.prisma.documentoMedicoPendiente.deleteMany({ where: { id } });
  }

  crearEnConsulta(
    consultaId: string,
    archivo: ArchivoMedicoGuardado,
  ): Promise<DocumentoMedicoSubidoDto> {
    return this.prisma.documentoMedico.create({
      data: { consultaId, ...archivo },
      select: SELECT_SUBIDO,
    });
  }

  async listarPorUsuaria(usuariaId: string): Promise<DocumentoMedicoDto[]> {
    const filas = await this.prisma.documentoMedico.findMany({
      where: {
        consulta: {
          atencion: {
            expediente: { usuariaId, ...EXPEDIENTE_REFERIDO_A_MEDICA },
          },
        },
      },
      select: {
        ...SELECT_SUBIDO,
        consultaId: true,
        mimeType: true,
        createdAt: true,
        consulta: {
          select: {
            fechaHora: true,
            nino: { select: { nombres: true, apellidos: true } },
            atencion: {
              select: {
                expediente: {
                  select: {
                    usuaria: { select: { nombres: true, apellidos: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return filas.map(({ consulta, ...documento }) => ({
      ...documento,
      createdAt: documento.createdAt.toISOString(),
      fechaConsulta: fechaCalendarioGT(consulta.fechaHora),
      personaNombre: nombreCompleto(
        consulta.nino ?? consulta.atencion.expediente.usuaria,
      ),
    }));
  }

  listarVencidos(limite: Date, cantidad: number): Promise<PendienteMedico[]> {
    return this.prisma.documentoMedicoPendiente.findMany({
      where: { expiraEn: { lt: limite } },
      select: SELECT_PENDIENTE,
      orderBy: { expiraEn: 'asc' },
      take: cantidad,
    });
  }
}
