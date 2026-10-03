import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvVars } from '../config/env.schema';
import type { IObjectStorage } from './interfaces/object-storage.interface';

export const MENSAJE_ALMACENAMIENTO_NO_DISPONIBLE =
  'No se pudo guardar el archivo en el almacenamiento. Inténtalo de nuevo en unos minutos.';

/**
 * Sin estos límites el SDK espera para siempre: una conexión colgada con R2 dejaría la
 * subida "cargando" sin fin. El SDK ya reintenta solo los fallos de red pasajeros (DNS,
 * conexión reiniciada, timeout) hasta `MAX_INTENTOS` veces antes de rendirse.
 */
const TIEMPO_MAXIMO_CONEXION_MS = 5_000;
// Inactividad, no duración total: una subida lenta pero que avanza no se corta.
const TIEMPO_MAXIMO_SIN_ACTIVIDAD_MS = 15_000;
const MAX_INTENTOS = 3;

@Injectable()
export class R2StorageService implements IObjectStorage {
  private readonly logger = new Logger(R2StorageService.name);

  // Corta duración a propósito (CLAUDE.md): suficiente para que el navegador siga el
  // redirect/descargue, no para quedar "viva" en un chat o un correo reenviado.
  private static readonly EXPIRACION_DESCARGA_SEGUNDOS = 300;

  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configService: ConfigService<EnvVars, true>) {
    this.bucket = configService.getOrThrow<string>('R2_BUCKET_NAME');
    this.client = new S3Client({
      region: 'auto',
      endpoint: configService.getOrThrow<string>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: configService.getOrThrow<string>(
          'R2_SECRET_ACCESS_KEY',
        ),
      },
      maxAttempts: MAX_INTENTOS,
      requestHandler: {
        connectionTimeout: TIEMPO_MAXIMO_CONEXION_MS,
        socketTimeout: TIEMPO_MAXIMO_SIN_ACTIVIDAD_MS,
      },
    });
  }

  async subirObjeto(
    clave: string,
    contenido: Buffer,
    mimeType: string,
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: clave,
          Body: contenido,
          ContentType: mimeType,
        }),
      );
    } catch (error) {
      // R2 inalcanzable tras los reintentos (red, DNS, credenciales): es un 503 reintentable,
      // no un fallo del sistema. Vale igual para Trabajo Social, Jurídico y Psicología. Solo se
      // registra el mensaje técnico, nunca la clave ni el nombre del archivo.
      this.logger.error(
        `No se pudo subir el objeto a R2: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
      throw new ServiceUnavailableException(
        MENSAJE_ALMACENAMIENTO_NO_DISPONIBLE,
      );
    }
  }

  async eliminarObjeto(clave: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: clave }),
    );
  }

  async generarUrlDescarga(
    clave: string,
    nombreDescarga?: string,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: clave,
        // encodeURIComponent también neutraliza intentos de inyección de cabeceras (CRLF)
        // si nombreDescarga viniera de un nombre de archivo o nombreVisible con caracteres raros.
        ResponseContentDisposition: nombreDescarga
          ? `attachment; filename*=UTF-8''${encodeURIComponent(nombreDescarga)}`
          : 'attachment',
      }),
      { expiresIn: R2StorageService.EXPIRACION_DESCARGA_SEGUNDOS },
    );
  }

  async generarUrlVistaPrevia(
    clave: string,
    mimeType: string,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: clave,
        ResponseContentDisposition: 'inline',
        ResponseContentType: mimeType,
      }),
      { expiresIn: R2StorageService.EXPIRACION_DESCARGA_SEGUNDOS },
    );
  }
}
