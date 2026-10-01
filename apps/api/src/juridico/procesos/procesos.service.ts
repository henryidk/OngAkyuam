import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EditarDatosProcesoInput,
  ListarProcesosQuery,
  ProcesoDetalle,
  ProcesosPaginados,
  ResumenProcesos,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { vacioANulo } from '../compartido/acceso-juridico';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import { AsignacionPersonalService } from '../compartido/asignacion-personal.service';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_CONFLICTO_VERSION,
  MENSAJE_PERSONAL_INEXISTENTE,
} from '../compartido/mensajes';
import { accionesDisponibles } from '../dominio/maquina-estado-proceso';
import { BITACORA_REPOSITORY } from '../interfaces/bitacora-repository.interface';
import type { IBitacoraRepository } from '../interfaces/bitacora-repository.interface';
import { CARPETAS_REPOSITORY } from '../interfaces/documentos-proceso-repository.interface';
import type { ICarpetasRepository } from '../interfaces/documentos-proceso-repository.interface';
import { PROCESOS_REPOSITORY } from '../interfaces/procesos-repository.interface';
import type { IProcesosRepository } from '../interfaces/procesos-repository.interface';

@Injectable()
export class ProcesosService {
  constructor(
    @Inject(PROCESOS_REPOSITORY)
    private readonly procesosRepository: IProcesosRepository,
    @Inject(BITACORA_REPOSITORY)
    private readonly bitacoraRepository: IBitacoraRepository,
    @Inject(CARPETAS_REPOSITORY)
    private readonly carpetasRepository: ICarpetasRepository,
    private readonly acceso: AccesoJuridicoService,
    private readonly asignacion: AsignacionPersonalService,
    private readonly auditService: AuditService,
  ) {}

  // Listado y resumen no reciben ids: el filtro de acceso va dentro de la propia consulta.
  listar(query: ListarProcesosQuery): Promise<ProcesosPaginados> {
    return this.procesosRepository.listar(query);
  }

  resumen(): Promise<ResumenProcesos> {
    return this.procesosRepository.resumen();
  }

  async obtenerDetalle(
    procesoId: string,
    contexto: ContextoAuditoria,
  ): Promise<ProcesoDetalle> {
    const acceso = await this.acceso.exigirProceso(procesoId);

    const [base, bitacora, carpetas, procesosUsuaria] = await Promise.all([
      this.procesosRepository.obtenerDetalleBase(procesoId),
      this.bitacoraRepository.listarPorProceso(procesoId),
      this.carpetasRepository.listarConDocumentos(procesoId),
      this.procesosRepository.listarPorUsuaria(acceso.usuariaId),
    ]);
    if (!base) {
      // El acceso se confirmó justo arriba: aquí solo cabe una carrera con un borrado.
      throw new NotFoundException('Proceso no encontrado');
    }

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'PROCESO_JURIDICO_CONSULTADO',
        entidad: 'ProcesoJuridico',
        entidadId: procesoId,
      }),
    );

    return {
      ...base,
      accionesDisponibles: accionesDisponibles(base),
      bitacora,
      carpetas,
      otrosProcesosUsuaria: procesosUsuaria.filter(
        (proceso) => proceso.id !== procesoId,
      ),
    };
  }

  async editarDatos(
    procesoId: string,
    datos: EditarDatosProcesoInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    const acceso = await this.acceso.exigirProceso(procesoId);

    const abogadaId = vacioANulo(datos.abogadaId);
    const procuradoraId = vacioANulo(datos.procuradoraId);
    // Solo se valida lo que cambia: un proceso conserva a su abogada aunque después la
    // desactiven en Administración, y eso no debe impedir corregir el número judicial.
    await this.asignacion.validar(
      abogadaId === acceso.abogadaId ? null : abogadaId,
      procuradoraId === acceso.procuradoraId ? null : procuradoraId,
    );

    const resultado = await this.procesosRepository.actualizarDatos({
      procesoId,
      version: datos.version,
      numeroJudicial: vacioANulo(datos.numeroJudicial),
      organoJudicial: vacioANulo(datos.organoJudicial),
      contraparte: vacioANulo(datos.contraparte),
      abogadaId,
      procuradoraId,
    });
    if (resultado === 'CONFLICTO_VERSION') {
      throw new ConflictException(MENSAJE_CONFLICTO_VERSION);
    }
    if (resultado === 'PERSONAL_INEXISTENTE') {
      throw new BadRequestException(MENSAJE_PERSONAL_INEXISTENTE);
    }

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'PROCESO_JURIDICO_DATOS_ACTUALIZADOS',
        entidad: 'ProcesoJuridico',
        entidadId: procesoId,
      }),
    );
  }
}
