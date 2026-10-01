import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  HistorialUsuariaDto,
  UsuariaJuridicoResumen,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import { MENSAJE_SIN_ACCESO_USUARIA } from '../compartido/mensajes';
import { contarProcesos } from '../dominio/contadores-usuaria';
import { PROCESOS_REPOSITORY } from '../interfaces/procesos-repository.interface';
import type { IProcesosRepository } from '../interfaces/procesos-repository.interface';
import { USUARIAS_JURIDICO_REPOSITORY } from '../interfaces/usuarias-repository.interface';
import type { IUsuariasJuridicoRepository } from '../interfaces/usuarias-repository.interface';

@Injectable()
export class HistorialUsuariaService {
  constructor(
    @Inject(USUARIAS_JURIDICO_REPOSITORY)
    private readonly usuariasRepository: IUsuariasJuridicoRepository,
    @Inject(PROCESOS_REPOSITORY)
    private readonly procesosRepository: IProcesosRepository,
    private readonly auditService: AuditService,
  ) {}

  async buscar(
    texto: string,
    contexto: ContextoAuditoria,
  ): Promise<UsuariaJuridicoResumen[]> {
    const resultados = await this.usuariasRepository.buscar(texto);

    // Queda constancia de que se buscó, nunca de qué se buscó: el texto es un nombre o un DPI.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      accion: 'USUARIAS_JURIDICO_BUSCADAS',
      detalles: { resultados: resultados.length },
    });

    return resultados;
  }

  async obtener(
    usuariaId: string,
    contexto: ContextoAuditoria,
  ): Promise<HistorialUsuariaDto> {
    const ficha = await this.usuariasRepository.obtenerFicha(usuariaId);
    if (!ficha) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_USUARIA);
    }
    const procesos = await this.procesosRepository.listarPorUsuaria(usuariaId);

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'HISTORIAL_USUARIA_JURIDICO_CONSULTADO',
        entidad: 'Usuaria',
        entidadId: usuariaId,
        detalles: { usuariaId },
      }),
    );

    return {
      usuaria: ficha.usuaria,
      contadores: contarProcesos(procesos),
      procesos,
      referencias: ficha.referencias,
    };
  }
}
