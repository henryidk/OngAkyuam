import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { EventoBitacora } from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import {
  ACCIONES_BITACORA,
  describirEvento,
} from '../eventos/plantillas-eventos';
import { BITACORA_REPOSITORY } from './interfaces/bitacora-repository.interface';
import type { IBitacoraRepository } from './interfaces/bitacora-repository.interface';

/** Tope de eventos por consulta: la bitácora se lee de arriba abajo, no se pagina. */
const LIMITE_EVENTOS_BITACORA = 200;

@Injectable()
export class BitacoraService {
  constructor(
    @Inject(BITACORA_REPOSITORY)
    private readonly bitacoraRepository: IBitacoraRepository,
    private readonly auditService: AuditService,
  ) {}

  async obtener(
    usuariaId: string,
    contexto: ContextoAuditoria,
  ): Promise<EventoBitacora[]> {
    if (!(await this.bitacoraRepository.existeUsuaria(usuariaId))) {
      throw new NotFoundException('Usuaria no encontrada');
    }

    const filas = await this.bitacoraRepository.eventosDeUsuaria(
      usuariaId,
      ACCIONES_BITACORA,
      LIMITE_EVENTOS_BITACORA,
    );

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'BITACORA_CONSULTADA',
      entidad: 'Usuaria',
      entidadId: usuariaId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });

    return filas.flatMap((fila) => {
      const evento = describirEvento(fila.accion, fila.detalles);
      if (!evento) {
        return [];
      }
      return [
        {
          id: fila.id,
          fecha: fila.createdAt.toISOString(),
          accion: fila.accion,
          texto: evento.texto,
          autor: fila.autor,
          numeroExpediente: fila.numeroExpediente,
          destacado: evento.destacado,
        },
      ];
    });
  }
}
