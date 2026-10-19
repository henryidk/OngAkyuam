/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import type { AuditService } from '../../auth/services/audit.service';
import { CompartidoService } from './compartido.service';
import { EstrategiasCompartido } from './estrategias-compartido';
import type { ICompartidoRepository } from './interfaces/compartido-repository.interface';

describe('CompartidoService', () => {
  let service: CompartidoService;
  let repositorio: jest.Mocked<ICompartidoRepository>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'ts-1',
    username: 'trabajo_social',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    repositorio = {
      areasReferidas: jest
        .fn()
        .mockResolvedValue(['JURIDICO', 'PSICOLOGIA', 'MEDICA']),
      procesosJuridicos: jest.fn().mockResolvedValue([]),
      procesosPsicologicos: jest.fn().mockResolvedValue([]),
      atencionesMedicas: jest.fn().mockResolvedValue([]),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new CompartidoService(
      repositorio,
      new EstrategiasCompartido(repositorio),
      auditService,
    );
  });

  it('lanza 404 si el expediente no existe y no audita', async () => {
    repositorio.areasReferidas.mockResolvedValue(null);

    await expect(service.obtener('exp-1', contexto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('devuelve una entrada por área, en el orden del catálogo', async () => {
    const compartido = await service.obtener('exp-1', contexto);

    expect(compartido.map((entrada) => entrada.area)).toEqual([
      'JURIDICO',
      'PSICOLOGIA',
      'MEDICA',
    ]);
  });

  it('Jurídico comparte tipo, estado, abogada y procuradora de cada proceso', async () => {
    repositorio.procesosJuridicos.mockResolvedValue([
      {
        tipo: 'GUARDA_CUSTODIA',
        fase: 'INICIADO',
        situacion: 'ACTIVO',
        abogada: 'Abogada Ficticia',
        procuradora: 'Procuradora Ficticia',
      },
      {
        tipo: 'MEDIDAS_SEGURIDAD',
        fase: 'FINALIZADO',
        situacion: 'ACTIVO',
        abogada: null,
        procuradora: null,
      },
    ]);

    const [juridico] = await service.obtener('exp-1', contexto);

    expect(juridico.lineas).toHaveLength(2);
    expect(juridico.lineas[0]).toContain('En trámite');
    expect(juridico.lineas[1]).toContain('Finalizado');
    expect(juridico.lineas[0]).toContain('Abogada: Abogada Ficticia');
    expect(juridico.lineas[0]).toContain('Procuradora: Procuradora Ficticia');
    expect(juridico.lineas[1]).not.toContain('Abogada');
  });

  it.each([
    ['INICIADO', 'ACTIVO', 'En trámite'],
    ['EN_PROCESO', 'ACTIVO', 'En trámite'],
    ['EN_PROCESO', 'SUSPENDIDO', 'Suspendido'],
    ['INICIADO', 'ABANDONADO', 'Abandonado'],
    // Un proceso finalizado se anuncia como tal aunque su situación haya quedado en otra cosa.
    ['FINALIZADO', 'ABANDONADO', 'Finalizado'],
  ] as const)(
    'Jurídico anuncia %s/%s como "%s"',
    async (fase, situacion, etiqueta) => {
      repositorio.procesosJuridicos.mockResolvedValue([
        {
          tipo: 'GUARDA_CUSTODIA',
          fase,
          situacion,
          abogada: null,
          procuradora: null,
        },
      ]);

      const [juridico] = await service.obtener('exp-1', contexto);

      expect(juridico.lineas[0]).toContain(etiqueta);
    },
  );

  const procesoPsicologico = {
    codigo: '05-2026',
    etapa: 'SEGUIMIENTO' as const,
    fechaInicio: '2026-10-01T15:00:00.000Z',
    fechaCierre: null,
    proximaCita: '2026-10-05T16:00:00.000Z',
    documentos: [
      {
        id: 'doc-1',
        tipo: 'FORMATO_ATENCION_PSICOLOGICA' as const,
        subidoEn: '2026-10-02T18:00:00.000Z',
      },
    ],
  };

  async function lineasPsicologia(): Promise<string[]> {
    const compartido = await service.obtener('exp-1', contexto);
    return compartido[1].lineas;
  }

  it('Psicología comparte código, etapa, fechas, próxima cita y documentos', async () => {
    repositorio.procesosPsicologicos.mockResolvedValue([procesoPsicologico]);

    expect(await lineasPsicologia()).toEqual([
      '05-2026 · En seguimiento · Inicio: 01/10/2026',
      'Próxima cita: 05/10/2026 10:00',
      'Documento: Formato general de atención psicológica (02/10/2026)',
    ]);
  });

  it('Psicología anuncia el cierre y el caso tomado que aún no tiene primera cita', async () => {
    repositorio.procesosPsicologicos.mockResolvedValue([
      {
        ...procesoPsicologico,
        etapa: 'CIERRE',
        fechaCierre: '2026-10-20T20:00:00.000Z',
        proximaCita: null,
        documentos: [],
      },
      {
        codigo: '05-2026 · Proceso 2',
        etapa: 'INICIO',
        fechaInicio: null,
        fechaCierre: null,
        proximaCita: null,
        documentos: [],
      },
    ]);

    expect(await lineasPsicologia()).toEqual([
      '05-2026 · Cierre · Inicio: 01/10/2026 · Cierre: 20/10/2026',
      '05-2026 · Proceso 2 · Inicio · Primera cita por agendar',
    ]);
  });

  it('las fechas se muestran en el día de Guatemala, no en el de UTC', async () => {
    repositorio.procesosPsicologicos.mockResolvedValue([
      {
        ...procesoPsicologico,
        // 02:00 UTC del día 8 = 20:00 del día 7 en Guatemala.
        fechaInicio: '2026-10-08T02:00:00.000Z',
        proximaCita: null,
        documentos: [],
      },
    ]);

    expect((await lineasPsicologia())[0]).toContain('Inicio: 07/10/2026');
  });

  it('Psicología nunca expone contenido clínico aunque el repositorio lo trajera por error', async () => {
    // La estrategia solo redacta los campos del contrato compartido: notas, motivo de cierre y
    // nombres de archivo no llegan a la respuesta ni si la fila los incluyera.
    repositorio.procesosPsicologicos.mockResolvedValue([
      {
        ...procesoPsicologico,
        resumenCierre: 'NOTA-CLINICA',
        motivoCierreCatalogo: 'DATO-CLINICO',
        documentos: [
          {
            ...procesoPsicologico.documentos[0],
            nombreArchivo: 'ARCHIVO-CLINICO.pdf',
          },
        ],
        citas: [{ temas: 'TEMA-CLINICO', observaciones: 'NOTA-CLINICA' }],
      } as never,
    ]);

    const respuesta = JSON.stringify(await service.obtener('exp-1', contexto));

    expect(respuesta).not.toContain('CLINIC');
    expect(respuesta).not.toContain('doc-1');
  });

  it('Psicología sin procesos no comparte nada', async () => {
    const compartido = await service.obtener('exp-1', contexto);

    expect(compartido[1]).toEqual({
      area: 'PSICOLOGIA',
      referida: true,
      lineas: [],
    });
  });

  it('no consulta a un área que no fue referida', async () => {
    repositorio.areasReferidas.mockResolvedValue(['JURIDICO']);

    const compartido = await service.obtener('exp-1', contexto);

    expect(repositorio.procesosPsicologicos).not.toHaveBeenCalled();
    expect(compartido[1]).toEqual({
      area: 'PSICOLOGIA',
      referida: false,
      lineas: [],
    });
  });

  const atencionMedica = {
    codigo: '05-2026',
    estado: 'ACTIVA' as const,
    fechasConsulta: ['2026-10-01T15:00:00.000Z', '2026-10-08T02:00:00.000Z'],
    proximaConsulta: '2026-10-16T16:00:00.000Z',
    signosVitales: {
      fecha: '2026-10-08T02:00:00.000Z',
      valores: {
        presionSistolica: 120,
        presionDiastolica: 80,
        frecuenciaCardiaca: 78,
        frecuenciaResp: null,
        temperaturaC: 36.5,
        saturacionO2: 98,
        glucosaMgDl: null,
        pesoKg: 60,
        tallaM: 1.55,
      },
    },
  };

  async function lineasMedicina(): Promise<string[]> {
    const compartido = await service.obtener('exp-1', contexto);
    return compartido[2].lineas;
  }

  it('Medicina comparte estado, fechas de consulta, próxima y signos vitales con etiquetas completas', async () => {
    repositorio.atencionesMedicas.mockResolvedValue([atencionMedica]);

    expect(await lineasMedicina()).toEqual([
      '05-2026 · En atención',
      'Consultas: 01/10/2026, 07/10/2026',
      'Próxima consulta: 16/10/2026 10:00',
      'Signos vitales (07/10/2026): Presión arterial 120/80 mmHg · Frecuencia cardíaca 78 latidos/min · Temperatura 36.5 °C · Oxígeno en sangre 98 % · Peso 60 kg · Talla 1.55 m · Índice de masa corporal 25',
    ]);
  });

  it('Medicina de alta sin consultas solo anuncia el estado', async () => {
    repositorio.atencionesMedicas.mockResolvedValue([
      {
        ...atencionMedica,
        estado: 'ALTA',
        fechasConsulta: [],
        proximaConsulta: null,
        signosVitales: null,
      },
    ]);

    expect(await lineasMedicina()).toEqual(['05-2026 · De alta']);
  });

  it('Medicina nunca expone diagnóstico, plan, receta ni documentos aunque el repositorio los trajera', async () => {
    repositorio.atencionesMedicas.mockResolvedValue([
      {
        ...atencionMedica,
        diagnostico: 'DIAGNOSTICO-CLINICO',
        planTratamiento: 'PLAN-CLINICO',
        recetaLaboratorios: 'RECETA-CLINICA',
        motivoConsulta: 'MOTIVO-CLINICO',
        documentos: [
          { id: 'doc-medico', nombreArchivo: 'ARCHIVO-CLINICO.pdf' },
        ],
      } as never,
    ]);

    const respuesta = JSON.stringify(await service.obtener('exp-1', contexto));

    expect(respuesta).not.toContain('CLINIC');
    expect(respuesta).not.toContain('doc-medico');
  });

  it('audita la consulta sin detalles', async () => {
    await service.obtener('exp-1', contexto);

    const auditoria = auditService.registrar.mock.calls[0][0];
    expect(auditoria.accion).toBe('COMPARTIDO_AREAS_CONSULTADO');
    expect(auditoria.entidadId).toBe('exp-1');
    expect(auditoria.detalles).toBeUndefined();
  });
});
