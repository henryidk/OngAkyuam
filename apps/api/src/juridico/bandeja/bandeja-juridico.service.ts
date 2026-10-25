import { Inject, Injectable } from '@nestjs/common';
import type { ReferenciaBandejaDto } from '@akyuam/shared';
import { REFERENCIAS_REPOSITORY } from '../interfaces/referencias-repository.interface';
import type { IReferenciasRepository } from '../interfaces/referencias-repository.interface';

@Injectable()
export class BandejaJuridicoService {
  constructor(
    @Inject(REFERENCIAS_REPOSITORY)
    private readonly referenciasRepository: IReferenciasRepository,
  ) {}

  /** Referencias pendientes: las más antiguas primero. */
  listar(): Promise<ReferenciaBandejaDto[]> {
    return this.referenciasRepository.listar();
  }
}
