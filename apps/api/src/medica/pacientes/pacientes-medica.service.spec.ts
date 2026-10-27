import { BadRequestException } from '@nestjs/common';
import {
  RESULTADOS_BUSCADOR_PACIENTES_MEDICA,
  SUGERENCIAS_BUSCADOR_PACIENTES_MEDICA,
  buscarPacientesProgramablesMedicaSchema,
} from '@akyuam/shared';
import type { BuscarPacientesProgramablesMedicaInput } from '@akyuam/shared';
import type { IReloj } from '../../common/reloj';
import type { IPacientesMedicaRepository } from '../interfaces/pacientes-medica-repository.interface';
import { PacientesMedicaService } from './pacientes-medica.service';

const AHORA = new Date('2026-10-26T15:00:00.000Z');

function preparar() {
  const buscarProgramables = jest.fn().mockResolvedValue([]);
  const repositorio = {
    buscarProgramables,
  } as unknown as IPacientesMedicaRepository;
  const reloj: IReloj = { ahora: () => AHORA };
  const service = new PacientesMedicaService(repositorio, reloj);
  const buscar = (entrada: BuscarPacientesProgramablesMedicaInput) =>
    service.buscarProgramables(
      buscarPacientesProgramablesMedicaSchema.parse(entrada),
    );
  return { buscarProgramables, buscar };
}

describe('PacientesMedicaService.buscarProgramables', () => {
  it('sin texto sugiere las por agendar que más esperan', async () => {
    const { buscarProgramables, buscar } = preparar();
    await buscar({ q: '   ' });
    expect(buscarProgramables).toHaveBeenCalledWith({
      busqueda: undefined,
      situaciones: ['POR_AGENDAR'],
      orden: 'referencia',
      limite: SUGERENCIAS_BUSCADOR_PACIENTES_MEDICA,
      ahora: AHORA,
    });
  });

  it('sin texto y solo en atención no sugiere a nadie', async () => {
    const { buscarProgramables, buscar } = preparar();
    await buscar({ situacion: 'EN_ATENCION' });
    expect(buscarProgramables).toHaveBeenCalledWith(
      expect.objectContaining({ situaciones: [] }),
    );
  });

  it('con un nombre busca entre en atención y por agendar, por relevancia', async () => {
    const { buscarProgramables, buscar } = preparar();
    await buscar({ q: ' María ' });
    expect(buscarProgramables).toHaveBeenCalledWith({
      busqueda: { tipo: 'nombre', valor: 'María' },
      situaciones: ['EN_ATENCION', 'POR_AGENDAR'],
      orden: 'relevancia',
      limite: RESULTADOS_BUSCADOR_PACIENTES_MEDICA,
      ahora: AHORA,
    });
  });

  it('respeta la situación pedida y reconoce el número de expediente', async () => {
    const { buscarProgramables, buscar } = preparar();
    await buscar({ q: '7-2026', situacion: 'EN_ATENCION' });
    expect(buscarProgramables).toHaveBeenCalledWith(
      expect.objectContaining({
        busqueda: { tipo: 'numeroExpediente', valor: '07-2026' },
        situaciones: ['EN_ATENCION'],
      }),
    );
  });

  it('un nombre de menos de 3 letras se rechaza sin consultar', () => {
    const { buscarProgramables, buscar } = preparar();
    expect(() => buscar({ q: 'ma' })).toThrow(BadRequestException);
    expect(buscarProgramables).not.toHaveBeenCalled();
  });

  it('la situación de alta no es buscable', () => {
    expect(
      buscarPacientesProgramablesMedicaSchema.safeParse({
        situacion: 'DE_ALTA',
      }).success,
    ).toBe(false);
  });
});
