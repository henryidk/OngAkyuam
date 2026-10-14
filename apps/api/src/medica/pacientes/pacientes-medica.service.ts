import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PAGINA_PACIENTES_MEDICA } from '@akyuam/shared';
import type {
  FichaPacienteMedicaDto,
  ListarPacientesMedicaQuery,
  PacientesMedicaPaginaDto,
} from '@akyuam/shared';
import { interpretarBusqueda } from '../../common/busqueda-usuarias';
import { MENSAJE_SIN_ACCESO_USUARIA } from '../compartido/mensajes';
import { RELOJ, type IReloj } from '../compartido/reloj';
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
