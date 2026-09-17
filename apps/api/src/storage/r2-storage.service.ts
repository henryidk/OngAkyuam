import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvVars } from '../config/env.schema';
import type { IObjectStorage } from './interfaces/object-storage.interface';

@Injectable()
export class R2StorageService implements IObjectStorage {
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
    });
  }

  async subirObjeto(
    clave: string,
    contenido: Buffer,
    mimeType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: clave,
        Body: contenido,
        ContentType: mimeType,
      }),
    );
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
}
