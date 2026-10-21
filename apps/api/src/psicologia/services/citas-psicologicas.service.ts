import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CitaPsicologicaDetalle } from '@akyuam/shared';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { AccesoPsicologiaService } from './acceso-psicologia.service';

@Injectable()
export class CitasPsicologicasService {
  constructor(
    private readonly acceso: AccesoPsicologiaService,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
  ) {}

  /** Permalink de una cita puntual — `GET /psicologia/citas/:id`. */
  async obtenerDetalleCita(
    citaId: string,
    psicologaId: string,
  ): Promise<CitaPsicologicaDetalle> {
    const lectura = await this.acceso.exigirLecturaCita(citaId, psicologaId);

    const cita = await this.citasRepository.obtenerDetalle(citaId);
    if (!cita) {
      throw new NotFoundException('Cita no encontrada');
    }
    const propia = cita.profesional
      ? cita.profesional.id === psicologaId
      : lectura.propia;
    return {
      ...cita,
      soloLectura: !propia,
      ...(cita.profesional
        ? {
            puedeAsumirAtencion:
              !propia &&
              cita.estado === 'PROGRAMADA' &&
              !cita.borrador &&
              cita.documento === null &&
              cita.procesoEtapa !== 'CIERRE',
          }
        : {}),
    };
  }
}
