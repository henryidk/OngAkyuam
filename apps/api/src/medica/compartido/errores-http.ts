import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AtencionNoActivaError,
  CitaNoDisponibleError,
  HorarioOcupadoError,
  LoteVencidoError,
  PersonaAjenaError,
  PersonasPrimeraConsultaError,
  PersonasVisitaIncompletaError,
  ReferenciaYaAtendidaError,
  SinReferenciaPendienteError,
  VersionCambioError,
} from '../interfaces/errores-medica';
import {
  MENSAJE_ATENCION_NO_ACTIVA,
  MENSAJE_HORARIO_OCUPADO,
  MENSAJE_LOTE_VENCIDO,
  MENSAJE_PERSONA_AJENA,
  MENSAJE_PERSONAS_PRIMERA_CONSULTA,
  MENSAJE_PERSONAS_VISITA_INCOMPLETA,
  MENSAJE_REFERENCIA_YA_ATENDIDA,
  MENSAJE_SIN_REFERENCIA_PENDIENTE,
} from './mensajes';

/** Código del 409 de horario ocupado: el frontend lo reconoce para recargar la disponibilidad. */
export const CODIGO_HORARIO_OCUPADO = 'HORARIO_OCUPADO';

/** Código del 409 de la primera consulta incompleta: el frontend recarga las personas. */
export const CODIGO_PERSONAS_PRIMERA_CONSULTA = 'PERSONAS_PRIMERA_CONSULTA';

/**
 * Traduce a HTTP, en un solo lugar, los errores de dominio que lanzan los repositorios. Los
 * mensajes que dependen del recurso (versión de la cita o de la atención, cita no disponible) los
 * pasa cada servicio. Lo que no es de dominio se relanza tal cual: nunca sale un error crudo de
 * Prisma, el filtro global lo convierte en 500 sin detalles.
 */
export function traducirErrorMedica(
  error: unknown,
  mensajes: { version?: string; citaNoDisponible?: string } = {},
): never {
  if (error instanceof HorarioOcupadoError) {
    throw new ConflictException({
      message: MENSAJE_HORARIO_OCUPADO,
      codigo: CODIGO_HORARIO_OCUPADO,
    });
  }
  if (error instanceof PersonasPrimeraConsultaError) {
    throw new ConflictException({
      message: MENSAJE_PERSONAS_PRIMERA_CONSULTA,
      codigo: CODIGO_PERSONAS_PRIMERA_CONSULTA,
    });
  }
  if (error instanceof PersonaAjenaError) {
    throw new BadRequestException(MENSAJE_PERSONA_AJENA);
  }
  if (error instanceof PersonasVisitaIncompletaError) {
    throw new BadRequestException(MENSAJE_PERSONAS_VISITA_INCOMPLETA);
  }
  if (error instanceof SinReferenciaPendienteError) {
    throw new ConflictException(MENSAJE_SIN_REFERENCIA_PENDIENTE);
  }
  if (error instanceof ReferenciaYaAtendidaError) {
    throw new ConflictException(MENSAJE_REFERENCIA_YA_ATENDIDA);
  }
  if (error instanceof AtencionNoActivaError) {
    throw new ConflictException(MENSAJE_ATENCION_NO_ACTIVA);
  }
  if (error instanceof LoteVencidoError) {
    throw new BadRequestException(MENSAJE_LOTE_VENCIDO);
  }
  if (error instanceof VersionCambioError && mensajes.version) {
    throw new ConflictException(mensajes.version);
  }
  if (error instanceof CitaNoDisponibleError && mensajes.citaNoDisponible) {
    throw new ConflictException(mensajes.citaNoDisponible);
  }
  throw error;
}
