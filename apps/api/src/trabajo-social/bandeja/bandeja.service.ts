import { Inject, Injectable } from '@nestjs/common';
import {
  diasDesdeFechaGT,
  fechaColumnaISO,
  type BandejaTs,
} from '@akyuam/shared';
import { BANDEJA_REPOSITORY } from './interfaces/bandeja-repository.interface';
import type { IBandejaRepository } from './interfaces/bandeja-repository.interface';

/** Filas visibles por cola; el resto se ve en Usuarias con el filtro correspondiente. */
export const FILAS_POR_COLA = 5;

function nombreCompleto(fila: { nombres: string; apellidos: string }): string {
  return `${fila.nombres} ${fila.apellidos}`;
}

@Injectable()
export class BandejaService {
  constructor(
    @Inject(BANDEJA_REPOSITORY)
    private readonly bandejaRepository: IBandejaRepository,
  ) {}

  // Sin auditoría de lectura: la bandeja se refresca sola por socket y cada refresco sería un
  // evento; lo sensible (abrir una ficha, una bitácora, un documento) ya se audita al abrirlo.
  // Global: todo el personal de Trabajo Social ve el mismo tablero, sin filtrar por quien
  // registró o refirió el caso.
  async obtener(): Promise<BandejaTs> {
    const [indicadores, pendientesReferir, enAlbergue] = await Promise.all([
      this.bandejaRepository.indicadores(),
      this.bandejaRepository.pendientesReferir(FILAS_POR_COLA),
      this.bandejaRepository.enAlbergue(FILAS_POR_COLA),
    ]);

    return {
      indicadores,
      pendientesReferir: {
        total: pendientesReferir.total,
        filas: pendientesReferir.filas.map((fila) => ({
          expedienteId: fila.expedienteId,
          usuariaId: fila.usuariaId,
          numeroExpediente: fila.numero,
          nombreCompleto: nombreCompleto(fila),
          tipoRegistro: fila.tipoRegistro,
          createdAt: fila.casoCreadoEn.toISOString(),
        })),
      },
      enAlbergue: {
        total: enAlbergue.total,
        filas: enAlbergue.filas.map((fila) => {
          const fechaIngreso = fila.fechaIngresoAlbergue
            ? fechaColumnaISO(fila.fechaIngresoAlbergue)
            : null;
          return {
            expedienteId: fila.expedienteId,
            usuariaId: fila.usuariaId,
            numeroExpediente: fila.numero,
            nombreCompleto: nombreCompleto(fila),
            fechaIngresoAlbergue: fechaIngreso,
            diasEnAlbergue: fechaIngreso
              ? diasDesdeFechaGT(fechaIngreso)
              : null,
            cantidadNinos: fila.cantidadNinos,
          };
        }),
      },
    };
  }
}
