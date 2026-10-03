import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvVars } from '../config/env.schema';
import { R2StorageService } from './r2-storage.service';

// @nestjs/config es ESM puro y Jest no lo carga; el servicio solo lo usa para leer la config,
// que aquí se pasa a mano.
jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

// Valores ficticios: el cliente nunca llega a la red porque `send` está simulado.
const CONFIG_FICTICIA: Record<string, string> = {
  R2_BUCKET_NAME: 'bucket-de-prueba',
  R2_ENDPOINT: 'https://cuenta-ficticia.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID: 'clave-ficticia',
  R2_SECRET_ACCESS_KEY: 'secreto-ficticio',
};

function crearServicio(): R2StorageService {
  const configService = {
    getOrThrow: (clave: string) => CONFIG_FICTICIA[clave],
  } as unknown as ConfigService<EnvVars, true>;
  return new R2StorageService(configService);
}

interface ClienteInterno {
  send: jest.Mock;
  config: {
    maxAttempts: () => Promise<number>;
    // Opciones ya resueltas del manejador HTTP (detalle interno del SDK, solo para la prueba).
    requestHandler: { configProvider: Promise<Record<string, unknown>> };
  };
}

function clienteDe(servicio: R2StorageService): ClienteInterno {
  return (servicio as unknown as { client: ClienteInterno }).client;
}

describe('R2StorageService', () => {
  it('configura tiempos de espera y reintentos para no quedarse colgado', async () => {
    const cliente = clienteDe(crearServicio());

    expect(await cliente.config.maxAttempts()).toBe(3);
    expect(await cliente.config.requestHandler.configProvider).toEqual(
      expect.objectContaining({
        connectionTimeout: 5_000,
        socketTimeout: 15_000,
      }),
    );
  });

  it('traduce un fallo de R2 a 503 y no registra la clave del objeto', async () => {
    const servicio = crearServicio();
    clienteDe(servicio).send = jest
      .fn()
      .mockRejectedValue(new Error('getaddrinfo EAI_AGAIN'));
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      servicio.subirObjeto(
        'expedientes/exp-1/clave-secreta',
        Buffer.from('x'),
        'application/pdf',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(logError).toHaveBeenCalledWith(expect.stringContaining('EAI_AGAIN'));
    expect(logError).toHaveBeenCalledWith(
      expect.not.stringContaining('clave-secreta'),
    );
    logError.mockRestore();
  });

  it('sube el objeto sin error cuando R2 responde', async () => {
    const servicio = crearServicio();
    const send = jest.fn().mockResolvedValue({});
    clienteDe(servicio).send = send;

    await servicio.subirObjeto('clave', Buffer.from('x'), 'image/png');

    expect(send).toHaveBeenCalledTimes(1);
  });
});
