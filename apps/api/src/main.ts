import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { EnvVars } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<EnvVars, true>>(ConfigService);

  app.use(compression());
  app.use(helmet());
  app.use(cookieParser());

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // credentials: true es obligatorio porque accessToken/refreshToken/csrfToken
  // viajan como cookies httpOnly, no en el body — sin esto el navegador no las
  // adjunta ni las guarda en peticiones cross-origin (frontend en otro puerto/host).
  app.enableCors({
    origin: configService.getOrThrow('FRONTEND_URL'),
    credentials: true,
  });

  app.setGlobalPrefix('api');

  await app.listen(configService.getOrThrow('API_PORT'));
}
void bootstrap();
