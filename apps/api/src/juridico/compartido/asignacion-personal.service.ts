import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { PersonalAsignado, TipoPersonalJuridico } from '@akyuam/shared';
import { PERSONAL_REPOSITORY } from '../../personal/interfaces/personal-repository.interface';
import type { IPersonalRepository } from '../../personal/interfaces/personal-repository.interface';

const MENSAJES: Record<TipoPersonalJuridico, string> = {
  ABOGADA: 'La abogada seleccionada no existe o no está activa',
  PROCURADORA: 'La procuradora seleccionada no existe o no está activa',
};

/**
 * Confirma contra `Personal` (existe, es de Jurídico, tiene el cargo correcto y está activa)
 * antes de guardar una asignación, en vez de depender solo de la llave foránea: así el error
 * dice qué campo está mal.
 */
@Injectable()
export class AsignacionPersonalService {
  constructor(
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepository: IPersonalRepository,
  ) {}

  async validar(
    abogadaId: string | null,
    procuradoraId: string | null,
  ): Promise<void> {
    await this.validarCargo(abogadaId, 'ABOGADA');
    await this.validarCargo(procuradoraId, 'PROCURADORA');
  }

  /** La responsable de una audiencia: siempre una abogada activa de Jurídico. */
  exigirAbogada(id: string): Promise<PersonalAsignado> {
    return this.exigirCargo(id, 'ABOGADA');
  }

  private async validarCargo(
    id: string | null,
    tipo: TipoPersonalJuridico,
  ): Promise<void> {
    if (id) {
      await this.exigirCargo(id, tipo);
    }
  }

  private async exigirCargo(
    id: string,
    tipo: TipoPersonalJuridico,
  ): Promise<PersonalAsignado> {
    const personal = await this.personalRepository.buscarActivo({
      id,
      area: 'JURIDICO',
      tipo,
    });
    if (!personal) {
      throw new BadRequestException(MENSAJES[tipo]);
    }
    return personal;
  }
}
