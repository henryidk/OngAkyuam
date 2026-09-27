import { Inject, Injectable } from '@nestjs/common';
import {
  finDiaGT,
  hoyGT,
  inicioHoyGT,
  inicioSemanaActualGT,
  type TableroPsicologia,
} from '@akyuam/shared';
import { ATENCION_PSICOLOGICA_REPOSITORY } from '../interfaces/atencion-psicologica-repository.interface';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';

/**
 * Compone directamente los dos repositorios del módulo en vez de pasar por
 * `ProcesoPsicologicoService` (§5.1 del plan) — el tablero no necesita ninguna de las reglas
 * de negocio de ese servicio (guards de acceso, auditoría de estado), solo lectura agregada.
 * Sin auditoría: mismo criterio ya usado por `listarAgenda`/`listarReferenciasSinTomar`.
 */
@Injectable()
export class TableroPsicologiaService {
  constructor(
    @Inject(ATENCION_PSICOLOGICA_REPOSITORY)
    private readonly atencionRepository: IAtencionPsicologicaRepository,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
  ) {}

  async obtenerTablero(psicologaId: string): Promise<TableroPsicologia> {
    const [
      totalCasosActivos,
      citasHoy,
      referenciasSinTomar,
      procesosSinProximaCita,
      cerradosEstaSemana,
    ] = await Promise.all([
      this.atencionRepository.contarCasosActivos(psicologaId),
      this.citasRepository.listarAgenda({
        psicologaId,
        desde: inicioHoyGT(),
        hasta: finDiaGT(hoyGT()),
      }),
      this.atencionRepository.listarReferenciasSinTomar(),
      this.atencionRepository.listarProcesosSinProximaCita(psicologaId),
      this.atencionRepository.listarCerradosDesde(
        psicologaId,
        inicioSemanaActualGT(),
      ),
    ]);

    return {
      metricas: {
        totalCasosActivos,
        citasHoyCount: citasHoy.length,
        referenciasSinTomarCount: referenciasSinTomar.length,
      },
      citasHoy,
      referenciasSinTomar,
      procesosSinProximaCita,
      cerradosEstaSemana,
    };
  }
}
