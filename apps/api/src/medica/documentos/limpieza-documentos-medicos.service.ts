import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { AuditService } from '../../auth/services/audit.service';
import {
  OBJECT_STORAGE,
  type IObjectStorage,
} from '../../storage/interfaces/object-storage.interface';
import {
  DOCUMENTOS_MEDICOS_REPOSITORY,
  type IDocumentosMedicosRepository,
} from '../interfaces/documentos-medicos-repository.interface';

const INTERVALO_LIMPIEZA_MS = 60 * 60 * 1000;
/**
 * Margen después del vencimiento: el registro de la consulta ya rechaza un pendiente vencido,
 * pero la limpieza espera una hora más para no borrar el archivo de uno que una transacción
 * está asociando en ese mismo instante.
 */
const MARGEN_LIMPIEZA_MS = 60 * 60 * 1000;
const TAMANIO_LOTE = 100;
/** Tope por corrida; lo que quede se borra en la siguiente. */
const MAXIMO_LOTES_POR_CORRIDA = 10;

/**
 * Borra los documentos de consultas que nunca se guardaron. Son archivos clínicos sin dueño: no
 * deben quedarse en R2. Mismo patrón que la limpieza de Trabajo Social (`setInterval` en el
 * proceso; con varias réplicas correría en todas, y borrar algo que ya no existe no falla).
 */
@Injectable()
export class LimpiezaDocumentosMedicosService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(LimpiezaDocumentosMedicosService.name);
  private temporizador: NodeJS.Timeout | undefined;
  private enCurso = false;

  constructor(
    @Inject(DOCUMENTOS_MEDICOS_REPOSITORY)
    private readonly repository: IDocumentosMedicosRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly auditService: AuditService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
    this.temporizador = setInterval(() => {
      void this.ejecutar();
    }, INTERVALO_LIMPIEZA_MS);
    this.temporizador.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.temporizador);
  }

  /** Devuelve cuántos se borraron. Nunca lanza: un fallo no debe tumbar el intervalo. */
  async ejecutar(ahora: Date = new Date()): Promise<number> {
    if (this.enCurso) {
      return 0;
    }
    this.enCurso = true;
    let borrados = 0;
    let fallidos = 0;
    try {
      const limite = new Date(ahora.getTime() - MARGEN_LIMPIEZA_MS);
      for (let lote = 0; lote < MAXIMO_LOTES_POR_CORRIDA; lote++) {
        const vencidos = await this.repository.listarVencidos(
          limite,
          TAMANIO_LOTE,
        );
        for (const vencido of vencidos) {
          try {
            await this.objectStorage.eliminarObjeto(vencido.claveObjeto);
            await this.repository.eliminarPendiente(vencido.id);
            borrados++;
          } catch {
            fallidos++;
          }
        }
        if (vencidos.length < TAMANIO_LOTE || fallidos > 0) {
          break;
        }
      }
    } catch (error) {
      this.logger.error(
        `Falló la limpieza de documentos médicos pendientes: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
    } finally {
      this.enCurso = false;
    }

    // Solo conteos: nunca claves ni nombres de archivo.
    if (fallidos > 0) {
      this.logger.warn(
        `No se pudieron borrar ${fallidos} documentos médicos pendientes vencidos; se reintentará`,
      );
    }
    if (borrados > 0) {
      this.logger.log(
        `Documentos médicos pendientes vencidos borrados: ${borrados}`,
      );
      await this.auditService
        .registrar({
          accion: 'DOCUMENTOS_MEDICOS_PENDIENTES_EXPIRADOS',
          entidad: 'DocumentoMedicoPendiente',
          detalles: { cantidad: borrados },
        })
        .catch(() => undefined);
    }
    return borrados;
  }
}
