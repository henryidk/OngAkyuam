import { ConflictException } from '@nestjs/common';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { CODIGO_TRASLAPE_CITA, MENSAJE_TRASLAPE } from './mensajes';

export interface CitaPorAvisar {
  psicologaId: string;
  fechaHora: Date;
  duracionMinutos: number;
  /** `true` en el reintento, cuando la psicóloga ya vio el aviso y decidió seguir. */
  confirmarTraslape: boolean;
  excluirCitaId?: string;
}

/** El traslape no bloquea: avisa una vez con 409 y la psicóloga puede confirmar. */
export async function avisarTraslape(
  citasRepository: ICitasPsicologicasRepository,
  cita: CitaPorAvisar,
): Promise<void> {
  if (cita.confirmarTraslape) {
    return;
  }
  const solapadas = await citasRepository.buscarCitasSolapadas({
    psicologaId: cita.psicologaId,
    fechaHora: cita.fechaHora,
    duracionMinutos: cita.duracionMinutos,
    excluirCitaId: cita.excluirCitaId,
  });
  if (solapadas.length > 0) {
    throw new ConflictException({
      message: MENSAJE_TRASLAPE,
      codigo: CODIGO_TRASLAPE_CITA,
      detalle: { citas: solapadas },
    });
  }
}
