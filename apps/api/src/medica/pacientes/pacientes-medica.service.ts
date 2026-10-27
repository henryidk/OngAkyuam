import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  PAGINA_PACIENTES_MEDICA,
  RESULTADOS_BUSCADOR_PACIENTES_MEDICA,
  SUGERENCIAS_BUSCADOR_PACIENTES_MEDICA,
} from '@akyuam/shared';
import type {
  BuscarPacientesProgramablesMedicaDatos,
  FichaPacienteMedicaDto,
  PacienteBuscadaMedicaDto,
  ListarPacientesMedicaQuery,
  PacientesMedicaPaginaDto,
} from '@akyuam/shared';
import { interpretarBusqueda } from '../../common/busqueda-usuarias';
import { MENSAJE_SIN_ACCESO_USUARIA } from '../compartido/mensajes';
import { RELOJ, type IReloj } from '../../common/reloj';
import {
  PACIENTES_MEDICA_REPOSITORY,
  type IPacientesMedicaRepository,
} from '../interfaces/pacientes-medica-repository.interface';

/** Lista de pacientes y ficha. Solo usuarias con algún expediente referido a Medicina. */
@Injectable()
export class PacientesMedicaService {
  constructor(
    @Inject(PACIENTES_MEDICA_REPOSITORY)
    private readonly pacientesRepository: IPacientesMedicaRepository,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  listar(query: ListarPacientesMedicaQuery): Promise<PacientesMedicaPaginaDto> {
    return this.pacientesRepository.listar({
      busqueda: interpretarBusqueda(query.q),
      estado: query.estado,
      cursor: query.cursor,
      porPagina: PAGINA_PACIENTES_MEDICA,
      ahora: this.reloj.ahora(),
    });
  }

  /**
   * Buscador de los modales de programar y de consulta sin cita. Con texto: hasta 10
   * coincidencias entre las pacientes en atención o por agendar. Sin texto: las por agendar que
   * más esperan, como sugerencia (ninguna si se pidieron solo las en atención).
   */
  buscarProgramables(
    datos: BuscarPacientesProgramablesMedicaDatos,
  ): Promise<PacienteBuscadaMedicaDto[]> {
    const busqueda = interpretarBusqueda(datos.q);
    const ahora = this.reloj.ahora();
    if (!busqueda) {
      return this.pacientesRepository.buscarProgramables({
        busqueda: undefined,
        situaciones: datos.situacion === 'EN_ATENCION' ? [] : ['POR_AGENDAR'],
        orden: 'referencia',
        limite: SUGERENCIAS_BUSCADOR_PACIENTES_MEDICA,
        ahora,
      });
    }
    return this.pacientesRepository.buscarProgramables({
      busqueda,
      situaciones: datos.situacion
        ? [datos.situacion]
        : ['EN_ATENCION', 'POR_AGENDAR'],
      orden: 'relevancia',
      limite: RESULTADOS_BUSCADOR_PACIENTES_MEDICA,
      ahora,
    });
  }

  async ficha(usuariaId: string): Promise<FichaPacienteMedicaDto> {
    const ficha = await this.pacientesRepository.ficha(
      usuariaId,
      this.reloj.ahora(),
    );
    if (!ficha) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_USUARIA);
    }
    return ficha;
  }
}
