import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Rol } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { COOKIE_NAMES } from '../../src/auth/constants/auth.constants';
import { TokenService } from '../../src/auth/services/token.service';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Datos de prueba de las E2E. Todo es ficticio y se marca como tal: nunca datos reales. Cada
 * prueba crea lo suyo con ids y números aleatorios, así no depende de lo que dejaron otras
 * corridas y nunca hace falta borrar tablas.
 */

export const MARCA = 'FICTICIO-E2E';

/** La app como en `main.ts`: cookies, filtro de errores y prefijo `/api`. */
export async function crearApp(): Promise<INestApplication<App>> {
  const modulo = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = modulo.createNestApplication<INestApplication<App>>();
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

function sufijo(): string {
  return randomBytes(4).toString('hex');
}

export async function crearUsuario(prisma: PrismaService, rol: Rol) {
  return prisma.usuario.create({
    data: {
      nombreCompleto: `${MARCA} ${rol}`,
      username: `e2e_${rol.toLowerCase()}_${sufijo()}`,
      // Nunca inicia sesión con contraseña: las pruebas firman el token directamente.
      passwordHash: 'sin-contrasena',
      rol,
      mustChangePassword: false,
    },
  });
}

/** Usuaria y expediente ficticios, referidos a las áreas indicadas. */
export async function crearExpediente(
  prisma: PrismaService,
  creadoPorId: string,
  referidoA: Rol[],
) {
  const usuaria = await prisma.usuaria.create({
    data: {
      nombres: MARCA,
      apellidos: `Usuaria ${sufijo()}`,
      fechaNacimiento: new Date('1990-01-01'),
      grupoEtnico: 'OTRO',
    },
  });
  const expediente = await prisma.expediente.create({
    data: {
      numero: `E2E-${sufijo()}`,
      usuariaId: usuaria.id,
      fecha: new Date('2026-01-01'),
      tipoRegistro: 'EXTERNA',
      creadoPorId,
      referidos: {
        create: referidoA.map((area) => ({ area, otorgadoPorId: creadoPorId })),
      },
    },
    include: { referidos: true },
  });
  return { usuaria, expediente };
}

/** Atención activa con una consulta (con datos clínicos marcados) y un documento. */
export async function crearAtencionConConsulta(
  prisma: PrismaService,
  expedienteId: string,
  medicaId: string,
  opciones: {
    visibleJuridico?: boolean;
    tipoDocumento?: 'CONSTANCIA' | 'RECETA';
  } = {},
) {
  const atencion = await prisma.atencionMedica.create({
    data: {
      expedienteId,
      consecutivo: 1,
      fechaInicio: new Date('2026-01-02'),
      visibleJuridico: opciones.visibleJuridico ?? false,
      creadoPorId: medicaId,
    },
  });
  const consulta = await prisma.consultaMedica.create({
    data: {
      atencionId: atencion.id,
      fechaHora: new Date('2026-01-02T15:00:00.000Z'),
      motivoConsulta: `${MARCA} motivo clínico`,
      presionSistolica: 120,
      presionDiastolica: 80,
      diagnostico: `${MARCA} diagnóstico clínico`,
      planTratamiento: `${MARCA} plan clínico`,
      recetaLaboratorios: `${MARCA} receta clínica`,
      registradaPorId: medicaId,
    },
  });
  const documento = await prisma.documentoMedico.create({
    data: {
      consultaId: consulta.id,
      tipo: opciones.tipoDocumento ?? 'RECETA',
      nombreVisible: `${MARCA} documento`,
      nombreArchivo: 'ficticio.pdf',
      claveObjeto: `medica/${expedienteId}/${atencion.id}/${randomUUID()}`,
      mimeType: 'application/pdf',
      tamanioBytes: 10,
      subidoPorId: medicaId,
    },
  });
  return { atencion, consulta, documento };
}

export interface Sesion {
  cookie: string;
  csrf: string;
}

/** Cookies de sesión como las deja el login: access token firmado y token CSRF. */
export function sesionDe(
  app: INestApplication,
  usuario: { id: string; username: string; rol: Rol },
): Sesion {
  const token = app.get(TokenService).signAccessToken({
    sub: usuario.id,
    username: usuario.username,
    rol: usuario.rol,
  });
  const csrf = randomBytes(16).toString('hex');
  return {
    cookie: `${COOKIE_NAMES.ACCESS_TOKEN}=${token}; ${COOKIE_NAMES.CSRF_TOKEN}=${csrf}`,
    csrf,
  };
}

/** Un instante aleatorio muy en el futuro: el índice de horario es global (una sola médica). */
export function instanteUnico(): Date {
  const minutos = Math.floor(Math.random() * 50_000_000);
  return new Date(Date.UTC(2100, 0, 1) + minutos * 60_000);
}

/** Abogada activa de Jurídico. Cada prueba usa la suya: el índice de horario es por responsable. */
export async function crearAbogada(prisma: PrismaService) {
  return prisma.personal.create({
    data: {
      area: 'JURIDICO',
      tipo: 'ABOGADA',
      nombre: `${MARCA} Abogada ${sufijo()}`,
    },
  });
}

/** Proceso jurídico abierto (salvo que se indique otra situación). */
export async function crearProceso(
  prisma: PrismaService,
  expedienteId: string,
  creadoPorId: string,
  datos: Partial<{
    situacion: 'ACTIVO' | 'SUSPENDIDO' | 'ABANDONADO';
    fase: 'EN_PROCESO' | 'FINALIZADO';
    numeroJudicial: string;
    consecutivo: number;
    fechaInicio: Date;
  }> = {},
) {
  return prisma.procesoJuridico.create({
    data: {
      expedienteId,
      tipo: 'MEDIDAS_SEGURIDAD',
      consecutivo: 1,
      fechaInicio: new Date('2026-01-05'),
      creadoPorId,
      ...datos,
    },
  });
}

/**
 * Un minuto exacto entre 2 y 600 días en el futuro: las audiencias solo se agendan a futuro y a
 * menos de 3 años, así que no sirve `instanteUnico`.
 */
export function instanteFuturo(): Date {
  const minutos = 2 * 24 * 60 + Math.floor(Math.random() * 598 * 24 * 60);
  const ahora = Math.floor(Date.now() / 60_000) * 60_000;
  return new Date(ahora + minutos * 60_000);
}
