import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  fechaCalendarioGT,
  formatInstanteGT,
  horaGT,
  type AccionAudiencia,
  type AudienciaAgendadaDto,
} from '@akyuam/shared';
import {
  MENSAJE_ACCION_AUDIENCIA_NO_DISPONIBLE,
  MENSAJE_AUDIENCIA_DEMASIADO_LEJOS,
  MENSAJE_AUDIENCIA_NO_ES_FUTURO,
  MENSAJE_CONFLICTO_VERSION_AUDIENCIA,
  MENSAJE_HORA_OCUPADA,
  MENSAJE_PROCESO_CERRADO_AUDIENCIA,
  MENSAJE_SIN_ACCESO_AUDIENCIA,
  MENSAJE_YA_TIENE_NUEVA_FECHA,
} from '../compartido/mensajes';
import {
  problemaHorarioAgenda,
  type ProblemaHorarioAudiencia,
} from '../dominio/horario-audiencia';
import { puedeAplicarAudiencia } from '../dominio/maquina-estado-audiencia';
import type {
  AudienciaParaEscritura,
  FalloEscrituraAudiencia,
  IAudienciasRepository,
  ResultadoEscrituraAudiencia,
} from '../interfaces/audiencias-repository.interface';

// Reglas que comparten los servicios que escriben audiencias (programación y resultado).

/** Todos son 409: el pedido era válido, pero el estado actual no lo permite. */
const MENSAJE_POR_FALLO: Record<FalloEscrituraAudiencia, string> = {
  VERSION_DESACTUALIZADA: MENSAJE_CONFLICTO_VERSION_AUDIENCIA,
  HORA_OCUPADA: MENSAJE_HORA_OCUPADA,
  PROCESO_CERRADO: MENSAJE_PROCESO_CERRADO_AUDIENCIA,
  YA_TIENE_NUEVA_FECHA: MENSAJE_YA_TIENE_NUEVA_FECHA,
};

const MENSAJE_POR_PROBLEMA_HORARIO: Record<ProblemaHorarioAudiencia, string> = {
  NO_ES_FUTURO: MENSAJE_AUDIENCIA_NO_ES_FUTURO,
  DEMASIADO_LEJOS: MENSAJE_AUDIENCIA_DEMASIADO_LEJOS,
};

/** La audiencia, solo a través de un proceso con acceso; si no, el mismo 403 que no existir. */
export async function exigirAudiencia(
  repositorio: IAudienciasRepository,
  audienciaId: string,
): Promise<AudienciaParaEscritura> {
  const audiencia = await repositorio.buscarParaEscritura(audienciaId);
  if (!audiencia) {
    throw new ForbiddenException(MENSAJE_SIN_ACCESO_AUDIENCIA);
  }
  return audiencia;
}

export function exigirAccion(
  accion: AccionAudiencia,
  audiencia: AudienciaParaEscritura,
  ahora: Date,
  mensaje: string = MENSAJE_ACCION_AUDIENCIA_NO_DISPONIBLE,
): void {
  if (!puedeAplicarAudiencia(accion, audiencia, ahora)) {
    throw new ConflictException(mensaje);
  }
}

export function exigirHorarioAgenda(inicio: Date, ahora: Date): void {
  const problema = problemaHorarioAgenda(inicio, ahora);
  if (problema) {
    throw new BadRequestException(MENSAJE_POR_PROBLEMA_HORARIO[problema]);
  }
}

export function exigirGuardado(
  resultado: ResultadoEscrituraAudiencia,
): Extract<ResultadoEscrituraAudiencia, { ok: true }> {
  if (!resultado.ok) {
    throw new ConflictException(MENSAJE_POR_FALLO[resultado.fallo]);
  }
  return resultado;
}

/** "21/10/2026 09:30", en hora de Guatemala: como se lee en la bitácora. */
export function momento(inicio: Date): string {
  return formatInstanteGT(inicio);
}

export function audienciaAgendada(
  id: string,
  inicio: Date,
): AudienciaAgendadaDto {
  return { id, fecha: fechaCalendarioGT(inicio), hora: horaGT(inicio) };
}
