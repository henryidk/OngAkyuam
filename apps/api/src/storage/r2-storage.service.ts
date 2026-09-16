import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvVars } from '../config/env.schema';
import type { IObjectStorage } from './interfaces/object-storage.interface';

@Injectable()
export class R2StorageService implements IObjectStorage {
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
}
