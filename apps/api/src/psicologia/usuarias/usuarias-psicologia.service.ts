import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { USUARIAS_PSICOLOGIA_POR_PAGINA } from '@akyuam/shared';
import type {
  FichaUsuariaPsicologiaDto,
  ListarUsuariasPsicologiaQuery,
  ListaUsuariasPsicologia,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import { interpretarBusqueda } from '../../common/busqueda-usuarias';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import { MENSAJE_SIN_ACCESO_USUARIA } from '../compartido/mensajes';
import { estaCerrado } from '../dominio/etapa-proceso';
import { CONSULTAS_PROCESOS_REPOSITORY } from '../interfaces/consultas-procesos-repository.interface';
import type { IConsultasProcesosRepository } from '../interfaces/consultas-procesos-repository.interface';
import { USUARIAS_PSICOLOGIA_REPOSITORY } from '../interfaces/usuarias-psicologia-repository.interface';
import type { IUsuariasPsicologiaRepository } from '../interfaces/usuarias-psicologia-repository.interface';

@Injectable()
export class UsuariasPsicologiaService {
  constructor(
    @Inject(USUARIAS_PSICOLOGIA_REPOSITORY)
    private readonly usuariasRepository: IUsuariasPsicologiaRepository,
    @Inject(CONSULTAS_PROCESOS_REPOSITORY)
    private readonly consultasRepository: IConsultasProcesosRepository,
    private readonly auditService: AuditService,
  ) {}

  async listar(
    query: ListarUsuariasPsicologiaQuery,
    contexto: ContextoAuditoria,
  ): Promise<ListaUsuariasPsicologia> {
    const busqueda = interpretarBusqueda(query.q);
    const lista = await this.usuariasRepository.listar({
      psicologaId: contexto.usuarioId,
      filtro: query.filtro,
      busqueda,
      pagina: query.pagina,
      porPagina: USUARIAS_PSICOLOGIA_POR_PAGINA,
    });

    // Queda constancia de que se listó y con qué filtro, nunca de qué se buscó: el texto es un
    // nombre o un DPI.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      accion: 'USUARIAS_PSICOLOGIA_LISTADAS',
      detalles: {
        filtro: query.filtro ?? null,
        conBusqueda: busqueda !== undefined,
        pagina: query.pagina,
        resultados: lista.filas.length,
      },
    });

    return lista;
  }

  async obtener(
    usuariaId: string,
    contexto: ContextoAuditoria,
  ): Promise<FichaUsuariaPsicologiaDto> {
    const ficha = await this.usuariasRepository.obtenerFicha(
      usuariaId,
      contexto.usuarioId,
    );
    if (!ficha) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_USUARIA);
    }
    const procesos = await this.consultasRepository.listarDeUsuaria(
      usuariaId,
      contexto.usuarioId,
      new Date(),
    );

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'FICHA_USUARIA_PSICOLOGIA_CONSULTADA',
        entidad: 'Usuaria',
        entidadId: usuariaId,
        detalles: { expedienteId: ficha.expediente.id },
      }),
    );

    const cerrados = procesos.filter((proceso) =>
      estaCerrado(proceso.etapa),
    ).length;
    return {
      ...ficha,
      contadores: { enProceso: procesos.length - cerrados, cerrados },
      procesos,
    };
  }
}
