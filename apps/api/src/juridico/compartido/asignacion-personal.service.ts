import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { PersonalAsignado, TipoPersonalJuridico } from '@akyuam/shared';
import { PERSONAL_REPOSITORY } from '../../personal/interfaces/personal-repository.interface';
import type { IPersonalRepository } from '../../personal/interfaces/personal-repository.interface';

const MENSAJES: Record<TipoPersonalJuridico, string> = {
  ABOGADA: 'La abogada seleccionada no existe o no está activa',
  PROCURADORA: 'La procuradora seleccionada no existe o no está activa',
};

export const MENSAJE_RESPONSABLE_AUDIENCIA_INVALIDA =
  'La responsable seleccionada no existe o no está activa';

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
    if (abogadaId) {
      await this.exigir(abogadaId, ['ABOGADA'], MENSAJES.ABOGADA);
    }
    if (procuradoraId) {
      await this.exigir(procuradoraId, ['PROCURADORA'], MENSAJES.PROCURADORA);
    }
  }

  /** La responsable de una audiencia: una abogada o una procuradora activa de Jurídico. */
  exigirResponsableAudiencia(id: string): Promise<PersonalAsignado> {
    return this.exigir(
      id,
      ['ABOGADA', 'PROCURADORA'],
      MENSAJE_RESPONSABLE_AUDIENCIA_INVALIDA,
    );
  }

  private async exigir(
    id: string,
    tipos: TipoPersonalJuridico[],
    mensaje: string,
  ): Promise<PersonalAsignado> {
    const personal = await this.personalRepository.buscarActivo({
      id,
      area: 'JURIDICO',
      tipos,
    });
    if (!personal) {
      throw new BadRequestException(mensaje);
    }
    return personal;
  }
}
