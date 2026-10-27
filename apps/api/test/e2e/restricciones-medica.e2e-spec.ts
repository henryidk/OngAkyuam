import type { INestApplication } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  crearApp,
  crearAtencionConConsulta,
  crearExpediente,
  crearNino,
  crearUsuario,
  instanteUnico,
} from './fixtures';

/**
 * Restricciones de la base (§5.3 del plan): índices parciales y CHECK que Prisma no sabe declarar
 * y que viven solo en `20261014054503_medica_restricciones`. Se prueban contra Postgres real
 * porque un mock no las aplicaría.
 */
describe('Medicina · restricciones de la base (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let medica: Usuario;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    medica = await crearUsuario(prisma, 'MEDICA');
  });

  afterAll(async () => {
    await app.close();
  });

  async function atencionActiva() {
    const { expediente } = await crearExpediente(prisma, medica.id, ['MEDICA']);
    const atencion = await prisma.atencionMedica.create({
      data: {
        expedienteId: expediente.id,
        consecutivo: 1,
        fechaInicio: new Date('2026-01-02'),
        creadoPorId: medica.id,
      },
    });
    return { expediente, atencion };
  }

  function cita(atencionId: string, inicio: Date, duracionMin = 30) {
    return prisma.citaMedica.create({
      data: { atencionId, inicio, duracionMin, creadoPorId: medica.id },
    });
  }

  const minutos = (inicio: Date, min: number) =>
    new Date(inicio.getTime() + min * 60_000);

  function consulta(atencionId: string, datos: Record<string, unknown>) {
    return prisma.consultaMedica.create({
      data: {
        atencionId,
        fechaHora: new Date(),
        diagnostico: 'Diagnóstico ficticio',
        registradaPorId: medica.id,
        ...datos,
      },
    });
  }

  it('no admite dos atenciones ACTIVA en el mismo expediente', async () => {
    const { expediente } = await atencionActiva();
    await expect(
      prisma.atencionMedica.create({
        data: {
          expedienteId: expediente.id,
          consecutivo: 2,
          fechaInicio: new Date('2026-01-03'),
          creadoPorId: medica.id,
        },
      }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it('sí admite una atención nueva cuando la anterior ya tiene alta', async () => {
    const { expediente, atencion } = await atencionActiva();
    await prisma.atencionMedica.update({
      where: { id: atencion.id },
      data: {
        estado: 'ALTA',
        fechaAlta: new Date('2026-01-10'),
        motivoAlta: 'ALTA_MEDICA',
      },
    });
    await expect(
      prisma.atencionMedica.create({
        data: {
          expedienteId: expediente.id,
          consecutivo: 2,
          fechaInicio: new Date('2026-01-11'),
          creadoPorId: medica.id,
        },
      }),
    ).resolves.toBeDefined();
  });

  it('no admite dos citas vigentes en el mismo horario', async () => {
    const { atencion } = await atencionActiva();
    const { atencion: otra } = await atencionActiva();
    const inicio = instanteUnico();
    await cita(atencion.id, inicio);
    await expect(cita(otra.id, inicio)).rejects.toThrow(
      /CitaMedica_sin_traslape_excl/,
    );
  });

  it('no admite citas que se traslapan aunque empiecen a horas distintas', async () => {
    const { atencion } = await atencionActiva();
    const { atencion: otra } = await atencionActiva();
    const inicio = instanteUnico();
    // Visita de 1 h 30: una de 30 min a la mitad choca con ella.
    await cita(atencion.id, inicio, 90);
    await expect(cita(otra.id, minutos(inicio, 60))).rejects.toThrow(
      /CitaMedica_sin_traslape_excl/,
    );
    // Y una de 1 h que empieza antes y termina dentro, también.
    await expect(cita(otra.id, minutos(inicio, -30), 60)).rejects.toThrow(
      /CitaMedica_sin_traslape_excl/,
    );
  });

  it('una cita puede empezar justo cuando termina la anterior', async () => {
    const { atencion } = await atencionActiva();
    const inicio = instanteUnico();
    await cita(atencion.id, inicio, 60);
    await expect(cita(atencion.id, minutos(inicio, 60))).resolves.toBeDefined();
    await expect(
      cita(atencion.id, minutos(inicio, -30)),
    ).resolves.toBeDefined();
  });

  it('solo admite duraciones de 30, 60 o 90 minutos', async () => {
    const { atencion } = await atencionActiva();
    await expect(cita(atencion.id, instanteUnico(), 45)).rejects.toThrow(
      /CitaMedica_duracion_chk/,
    );
    await expect(cita(atencion.id, instanteUnico(), 120)).rejects.toThrow(
      /CitaMedica_duracion_chk/,
    );
  });

  it('una persona no se repite en la misma cita (usuaria ni hijo/a)', async () => {
    const { expediente, atencion } = await atencionActiva();
    const nino = await crearNino(prisma, expediente.id);
    const { id: citaId } = await cita(atencion.id, instanteUnico());
    await prisma.citaMedicaPersona.createMany({
      data: [
        { citaId, ninoId: null },
        { citaId, ninoId: nino.id },
      ],
    });
    await expect(
      prisma.citaMedicaPersona.create({ data: { citaId, ninoId: null } }),
    ).rejects.toThrow(/Unique constraint/);
    await expect(
      prisma.citaMedicaPersona.create({ data: { citaId, ninoId: nino.id } }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it('una cita familiar admite una consulta por persona, no dos', async () => {
    const { expediente, atencion } = await atencionActiva();
    const nino = await crearNino(prisma, expediente.id);
    const { id: citaId } = await cita(atencion.id, instanteUnico());
    await consulta(atencion.id, { citaId, ninoId: null });
    await consulta(atencion.id, { citaId, ninoId: nino.id });
    await expect(
      consulta(atencion.id, { citaId, ninoId: null }),
    ).rejects.toThrow(/Unique constraint/);
    await expect(
      consulta(atencion.id, { citaId, ninoId: nino.id }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it('las consultas sin cita de la misma persona no chocan entre sí', async () => {
    const { atencion } = await atencionActiva();
    await consulta(atencion.id, { citaId: null, ninoId: null });
    await expect(
      consulta(atencion.id, { citaId: null, ninoId: null }),
    ).resolves.toBeDefined();
  });

  it('una NO_ASISTIO libera el horario para una PROGRAMADA', async () => {
    const { atencion } = await atencionActiva();
    const inicio = instanteUnico();
    await prisma.citaMedica.create({
      data: {
        atencionId: atencion.id,
        inicio,
        estado: 'NO_ASISTIO',
        creadoPorId: medica.id,
      },
    });
    await expect(cita(atencion.id, inicio)).resolves.toBeDefined();
  });

  it('el alta con motivo OTRO exige nota', async () => {
    const { atencion } = await atencionActiva();
    await expect(
      prisma.atencionMedica.update({
        where: { id: atencion.id },
        data: {
          estado: 'ALTA',
          fechaAlta: new Date('2026-01-10'),
          motivoAlta: 'OTRO',
          notaAlta: '   ',
        },
      }),
    ).rejects.toThrow(/AtencionMedica_otro_chk/);
  });

  it('ALTA sin fecha ni motivo no se admite', async () => {
    const { atencion } = await atencionActiva();
    await expect(
      prisma.atencionMedica.update({
        where: { id: atencion.id },
        data: { estado: 'ALTA' },
      }),
    ).rejects.toThrow(/AtencionMedica_alta_chk/);
  });

  it('la presión se registra completa o no se registra', async () => {
    const { atencion } = await atencionActiva();
    await expect(
      consulta(atencion.id, { presionSistolica: 120 }),
    ).rejects.toThrow(/ConsultaMedica_rangos_chk/);
  });

  it('una temperatura de 50 °C está fuera del rango de captura', async () => {
    const { atencion } = await atencionActiva();
    await expect(consulta(atencion.id, { temperaturaC: 50 })).rejects.toThrow(
      /ConsultaMedica_rangos_chk/,
    );
  });

  it('el diagnóstico no puede quedar en blanco', async () => {
    const { atencion } = await atencionActiva();
    await expect(consulta(atencion.id, { diagnostico: '   ' })).rejects.toThrow(
      /ConsultaMedica_dx_chk/,
    );
  });

  it('una consulta con signos dentro de rango sí se guarda', async () => {
    const { expediente } = await crearExpediente(prisma, medica.id, ['MEDICA']);
    await expect(
      crearAtencionConConsulta(prisma, expediente.id, medica.id),
    ).resolves.toBeDefined();
  });
});
