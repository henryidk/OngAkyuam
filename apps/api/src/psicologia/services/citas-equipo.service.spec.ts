import { BadRequestException } from '@nestjs/common';
import {
  agendaPsicologiaQuerySchema,
  citasPsicologiaQuerySchema,
} from '@akyuam/shared';
import { CitasEquipoService } from './citas-equipo.service';
import type { CitasEquipoRepository } from '../repositories/citas-equipo.repository';
import type { CitasPsicologicasService } from './citas-psicologicas.service';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { crearAuditService } from '../pruebas/dobles';

describe('consulta de citas del equipo', () => {
  it('mis pacientes es predeterminado en agenda y el texto false solicita todo el equipo', () => {
    expect(
      agendaPsicologiaQuerySchema.parse({
        desde: '2026-10-01',
        hasta: '2026-10-31',
      }).soloMios,
    ).toBe(true);
    expect(
      agendaPsicologiaQuerySchema.parse({
        desde: '2026-10-01',
        hasta: '2026-10-31',
        soloMios: 'false',
      }).soloMios,
    ).toBe(false);
    expect(
      agendaPsicologiaQuerySchema.safeParse({
        desde: '2026-02-30',
        hasta: '2026-03-01',
      }).success,
    ).toBe(false);
  });
  it('rechaza fechas invertidas y páginas no válidas', () => {
    expect(
      citasPsicologiaQuerySchema.safeParse({
        desde: '2026-10-31',
        hasta: '2026-10-01',
      }).success,
    ).toBe(false);
    expect(
      citasPsicologiaQuerySchema.safeParse({
        desde: '2026-10-01',
        hasta: '2026-10-31',
        pagina: 0,
      }).success,
    ).toBe(false);
  });
  it('acota la consulta a un año antes de acceder a datos', () => {
    const listar = jest.fn();
    const service = new CitasEquipoService(
      { listar } as unknown as CitasEquipoRepository,
      {} as CitasPsicologicasService,
      {} as ICitasPsicologicasRepository,
      crearAuditService(),
    );
    expect(() =>
      service.listar(
        {
          desde: '2025-01-01',
          hasta: '2026-10-21',
          soloMios: false,
          pagina: 1,
        },
        'id',
      ),
    ).toThrow(BadRequestException);
    expect(listar).not.toHaveBeenCalled();
  });
});
