import type { PrismaService } from '../../prisma/prisma.service';
import { VisibilidadMedicaReader } from './visibilidad-medica.reader';

// Lo que Medicina comparte depende solo de estos filtros: un error aquí muestra fechas o
// documentos médicos de una sobreviviente a un área que la médica no autorizó.

describe('VisibilidadMedicaReader', () => {
  const prisma = {
    atencionMedica: { findMany: jest.fn().mockResolvedValue([]) },
    documentoMedico: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const reader = new VisibilidadMedicaReader(
    prisma as unknown as PrismaService,
  );
  const argumentos = (mock: jest.Mock) =>
    (mock.mock.calls as unknown[][]).at(-1)?.[0] as {
      where: unknown;
      select: Record<string, unknown>;
    };

  it('Jurídico: solo atenciones visibles para Jurídico, de la usuaria y referidas a Jurídico', async () => {
    await reader.paraJuridico('u-1');
    const { where, select } = argumentos(prisma.atencionMedica.findMany);
    expect(where).toEqual({
      visibleJuridico: true,
      expediente: {
        usuariaId: 'u-1',
        referidos: { some: { area: 'JURIDICO' } },
      },
    });
    expect(JSON.stringify(select)).not.toMatch(
      /diagnostico|planTratamiento|recetaLaboratorios|motivoConsulta|presion|claveObjeto/,
    );
    expect(JSON.stringify(select)).toContain('"documentos"');
  });

  it('Psicología: solo atenciones visibles para Psicología y solo fechas', async () => {
    await reader.paraPsicologia('u-1');
    const { where, select } = argumentos(prisma.atencionMedica.findMany);
    expect(where).toEqual({
      visiblePsicologia: true,
      expediente: {
        usuariaId: 'u-1',
        referidos: { some: { area: 'PSICOLOGIA' } },
      },
    });
    expect(JSON.stringify(select)).not.toMatch(
      /diagnostico|planTratamiento|recetaLaboratorios|documentos|presion/,
    );
  });

  it('el documento se busca por id y atención visible para Jurídico', async () => {
    await expect(
      reader.documentoParaJuridico('u-1', 'd-1'),
    ).resolves.toBeNull();
    expect(argumentos(prisma.documentoMedico.findFirst).where).toEqual({
      id: 'd-1',
      consulta: {
        atencion: {
          visibleJuridico: true,
          expediente: {
            usuariaId: 'u-1',
            referidos: { some: { area: 'JURIDICO' } },
          },
        },
      },
    });
  });
});
