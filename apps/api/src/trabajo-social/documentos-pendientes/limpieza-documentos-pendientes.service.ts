import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { AuditService } from '../../auth/services/audit.service';
import { OBJECT_STORAGE } from '../../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import {
  DOCUMENTOS_PENDIENTES_REPOSITORY,
  VIDA_UTIL_DOCUMENTO_PENDIENTE_MS,
} from './interfaces/documentos-pendientes-repository.interface';
import type { IDocumentosPendientesRepository } from './interfaces/documentos-pendientes-repository.interface';

const INTERVALO_LIMPIEZA_MS = 60 * 60 * 1000;
/**
 * Margen sobre la vida útil: el registro deja de aceptar un pendiente a las 24 h, pero la
 * limpieza espera una hora más — así nunca borra el objeto de uno que una transacción de
 * registro está adjuntando en ese mismo instante.
 */
const MARGEN_LIMPIEZA_MS = 60 * 60 * 1000;
const TAMANIO_LOTE = 100;
/** Tope por corrida para no acaparar el proceso; lo que quede se borra en la siguiente. */
const MAXIMO_LOTES_POR_CORRIDA = 10;

/**
 * Borra los escaneos de registros abandonados (subidos en el paso "Documentos" pero nunca
 * adjuntados a un expediente). Son documentos sensibles sin dueño: no deben quedarse en R2.
 *
 * Corre dentro del mismo proceso con un `setInterval` (no hace falta otra dependencia ni otro
 * servicio). Si en el futuro hay varias réplicas del API, correrían todas — es inofensivo: borrar
 * un objeto o una fila que ya no existe no falla.
 */
@Injectable()
export class LimpiezaDocumentosPendientesService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(
    LimpiezaDocumentosPendientesService.name,
  );
  private temporizador: NodeJS.Timeout | undefined;
  private enCurso = false;

  constructor(
    @Inject(DOCUMENTOS_PENDIENTES_REPOSITORY)
    private readonly repository: IDocumentosPendientesRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly auditService: AuditService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
    this.temporizador = setInterval(() => {
      void this.ejecutar();
    }, INTERVALO_LIMPIEZA_MS);
    // No mantiene vivo el proceso (ni los tests) solo por este temporizador.
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
      const limite = new Date(
        ahora.getTime() - VIDA_UTIL_DOCUMENTO_PENDIENTE_MS - MARGEN_LIMPIEZA_MS,
      );
      for (let lote = 0; lote < MAXIMO_LOTES_POR_CORRIDA; lote++) {
        const vencidos = await this.repository.listarVencidos(
          limite,
          TAMANIO_LOTE,
        );
        for (const vencido of vencidos) {
          try {
            // Primero el objeto, luego la fila: si R2 falla, la fila sigue ahí y la próxima
            // corrida lo reintenta. Al revés quedaría un escaneo en R2 que nadie recuerda.
            await this.objectStorage.eliminarObjeto(vencido.claveR2);
            await this.repository.eliminar(vencido.id);
            borrados++;
          } catch {
            fallidos++;
          }
        }
        // Lote incompleto o con fallos (se repetirían en la siguiente vuelta): se termina aquí.
        if (vencidos.length < TAMANIO_LOTE || fallidos > 0) {
          break;
        }
      }
    } catch (error) {
      this.logger.error(
        `Falló la limpieza de documentos pendientes: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
    } finally {
      this.enCurso = false;
    }

    // Solo conteos: nunca claves ni nombres de archivo.
    if (fallidos > 0) {
      this.logger.warn(
        `No se pudieron borrar ${fallidos} documentos pendientes vencidos; se reintentará`,
      );
    }
    if (borrados > 0) {
      this.logger.log(`Documentos pendientes vencidos borrados: ${borrados}`);
      await this.auditService
        .registrar({
          accion: 'DOCUMENTOS_PENDIENTES_EXPIRADOS',
          entidad: 'DocumentoPendiente',
          detalles: { cantidad: borrados },
        })
        .catch(() => undefined);
    }
    return borrados;
  }
}
