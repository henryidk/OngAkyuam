import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { TipoPersonalJuridico } from '@akyuam/shared';
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

  private async validarCargo(
    id: string | null,
    tipo: TipoPersonalJuridico,
  ): Promise<void> {
    if (!id) {
      return;
    }
    const existe = await this.personalRepository.buscarActivo({
      id,
      area: 'JURIDICO',
      tipo,
    });
    if (!existe) {
      throw new BadRequestException(MENSAJES[tipo]);
    }
  }
}
