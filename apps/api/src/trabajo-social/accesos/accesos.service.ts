import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ActualizarAccesoInput,
  AreaAtencion,
  MatrizAccesos,
  TipoDocumentoTrabajoSocial,
} from '@akyuam/shared';
import { PoliticasAcceso } from '../../areas/politicas/politicas-acceso';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ACCESOS_REPOSITORY } from './interfaces/accesos-repository.interface';
import type {
  ExpedienteParaAccesos,
  IAccesosRepository,
} from './interfaces/accesos-repository.interface';
import { construirMatrizAccesos } from './matriz-accesos';

@Injectable()
export class AccesosService {
  constructor(
    @Inject(ACCESOS_REPOSITORY)
    private readonly accesosRepository: IAccesosRepository,
    private readonly politicasAcceso: PoliticasAcceso,
    private readonly auditService: AuditService,
  ) {}

  async obtenerMatriz(expedienteId: string): Promise<MatrizAccesos> {
    const expediente = await this.buscarExpedienteOFallar(expedienteId);
    return construirMatrizAccesos(expediente, this.politicasAcceso);
  }

  async actualizar(
    expedienteId: string,
    area: AreaAtencion,
    cambios: ActualizarAccesoInput,
    contexto: ContextoAuditoria,
  ): Promise<MatrizAccesos> {
    const expediente = await this.buscarExpedienteOFallar(expedienteId);

    if (!this.politicasAcceso.para(area).esRestringible()) {
      throw new BadRequestException(
        'Jurídico tiene acceso completo por normativa',
      );
    }
    if (!expediente.referidos.some((referido) => referido.area === area)) {
      throw new BadRequestException('Primero refiere a la usuaria a esta área');
    }

    const cambiosDocumentos = Object.entries(cambios.documentos ?? {}) as [
      TipoDocumentoTrabajoSocial,
      boolean,
    ][];
    const documentos = cambiosDocumentos.map(([tipo, visible]) => {
      const vigente = expediente.documentos.find(
        (documento) => documento.tipo === tipo,
      );
      if (!vigente) {
        throw new BadRequestException(
          'Ese documento todavía no se ha subido a este caso',
        );
      }
      return { documentoId: vigente.id, visible };
    });

    await this.accesosRepository.actualizar({
      expedienteId,
      area,
      datosCaso: cambios.datosCaso,
      documentos,
      otorgadoPorId: contexto.usuarioId,
    });

    // Solo áreas, tipos y valores booleanos: nada identificable de la usuaria.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'ACCESO_AREA_MODIFICADO',
      entidad: 'Expediente',
      entidadId: expedienteId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: {
        area,
        ...(cambios.datosCaso !== undefined && {
          datosCaso: cambios.datosCaso,
        }),
        ...(cambiosDocumentos.length > 0 && {
          documentos: Object.fromEntries(cambiosDocumentos),
        }),
      },
    });

    return this.obtenerMatriz(expedienteId);
  }

  private async buscarExpedienteOFallar(
    expedienteId: string,
  ): Promise<ExpedienteParaAccesos> {
    const expediente =
      await this.accesosRepository.buscarExpediente(expedienteId);
    if (!expediente) {
      throw new NotFoundException('Expediente no encontrado');
    }
    return expediente;
  }
}
