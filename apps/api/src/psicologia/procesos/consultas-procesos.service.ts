import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PROCESOS_PSICOLOGIA_POR_PAGINA } from '@akyuam/shared';
import type {
  ListarProcesosPsicologiaQuery,
  ProcesoPsicologiaDetalle,
  ProcesosPsicologiaPaginados,
  ResumenProcesosPsicologia,
  SesionesProcesoPaginadas,
  SesionesProcesoPsicologiaQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import { MENSAJE_SIN_ACCESO_PROCESO } from '../compartido/mensajes';
import { accionesDisponibles } from '../dominio/etapa-proceso';
import { CONSULTAS_PROCESOS_REPOSITORY } from '../interfaces/consultas-procesos-repository.interface';
import type { IConsultasProcesosRepository } from '../interfaces/consultas-procesos-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

const SESIONES_POR_PAGINA = 20;
const PALABRAS_MAXIMAS = 5;

/**
 * Parte lo escrito en el buscador en palabras. Se quitan los comodines de `LIKE` para que
 * "%" o "_" no hagan coincidir todo.
 */
export function palabrasDeBusqueda(q: string | undefined): string[] {
  if (!q) {
    return [];
  }
  return q
    .split(/\s+/)
    .map((palabra) => palabra.replace(/[%_\\]/g, ''))
    .filter((palabra) => palabra.length > 0)
    .slice(0, PALABRAS_MAXIMAS);
}

/**
 * Lecturas de procesos. Las listas y los contadores son solo de la psicóloga que consulta; el
 * detalle y las sesiones se abren además sobre el proceso ya cerrado de una colega con una
 * usuaria que ella también atiende, siempre en solo lectura.
 */
@Injectable()
export class ConsultasProcesosService {
  constructor(
    @Inject(CONSULTAS_PROCESOS_REPOSITORY)
    private readonly consultasRepository: IConsultasProcesosRepository,
    private readonly acceso: AccesoPsicologiaService,
    private readonly auditService: AuditService,
  ) {}

  listar(
    query: ListarProcesosPsicologiaQuery,
    psicologaId: string,
  ): Promise<ProcesosPsicologiaPaginados> {
    return this.consultasRepository.listar({
      psicologaId,
      filtro: query.filtro,
      palabras: palabrasDeBusqueda(query.q),
      cursor: query.cursor,
      limite: PROCESOS_PSICOLOGIA_POR_PAGINA,
      ahora: new Date(),
    });
  }

  /** Contadores de las tarjetas de Procesos y de los avisos del menú lateral. */
  resumen(psicologaId: string): Promise<ResumenProcesosPsicologia> {
    return this.consultasRepository.resumen(psicologaId, new Date());
  }

  async obtener(
    procesoId: string,
    contexto: ContextoAuditoria,
  ): Promise<ProcesoPsicologiaDetalle> {
    const detalle = await this.consultasRepository.obtenerDetalle(
      procesoId,
      contexto.usuarioId,
      new Date(),
    );
    if (!detalle) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO);
    }

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'PROCESO_PSICOLOGICO_CONSULTADO',
        entidad: 'AtencionPsicologica',
        entidadId: procesoId,
        detalles: {
          expedienteId: detalle.expedienteId,
          deColega: detalle.soloLectura,
        },
      }),
    );

    return {
      ...detalle,
      // Sobre el proceso de una colega no hay nada que hacer: ni siquiera la visibilidad.
      accionesDisponibles: detalle.soloLectura
        ? []
        : accionesDisponibles(detalle.etapa),
    };
  }

  /**
   * Las notas de sesión: la dueña del proceso, o quien retoma a la usuaria cuando el proceso de
   * su colega ya está cerrado. Cada lectura queda auditada, y se anota si fue de una colega.
   */
  async sesiones(
    procesoId: string,
    query: SesionesProcesoPsicologiaQuery,
    contexto: ContextoAuditoria,
  ): Promise<SesionesProcesoPaginadas> {
    const proceso = await this.acceso.exigirLecturaProceso(
      procesoId,
      contexto.usuarioId,
    );

    const pagina = await this.consultasRepository.listarSesiones({
      procesoId,
      cursor: query.cursor,
      limite: SESIONES_POR_PAGINA,
    });

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'SESIONES_PROCESO_PSICOLOGICO_CONSULTADAS',
        entidad: 'AtencionPsicologica',
        entidadId: procesoId,
        detalles: {
          expedienteId: proceso.expedienteId,
          deColega: !proceso.propio,
          resultados: pagina.items.length,
        },
      }),
    );

    return pagina;
  }
}
