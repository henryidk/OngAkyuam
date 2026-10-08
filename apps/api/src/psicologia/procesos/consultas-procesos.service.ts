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

/** Lecturas de "mis procesos": todo lo que sale de aquí es de la psicóloga que consulta. */
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
        detalles: { expedienteId: detalle.expedienteId },
      }),
    );

    return {
      ...detalle,
      accionesDisponibles: accionesDisponibles(detalle.etapa),
    };
  }

  /** Las notas de sesión: solo la psicóloga dueña del proceso, y cada lectura queda auditada. */
  async sesiones(
    procesoId: string,
    query: SesionesProcesoPsicologiaQuery,
    contexto: ContextoAuditoria,
  ): Promise<SesionesProcesoPaginadas> {
    const proceso = await this.acceso.exigirAccesoProceso(
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
          resultados: pagina.items.length,
        },
      }),
    );

    return pagina;
  }
}
