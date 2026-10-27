/**
 * Una familia FICTICIA de Medicina para ver la historia clínica agrupada por visita. Ningún dato
 * corresponde a una persona real: los apellidos llevan "Ficticia", el DPI es de ceros y todo
 * texto clínico dice "Dato ficticio".
 *
 * Deja a la usuaria con tres hijos/as y una atención activa con 26 consultas, armadas para ver:
 *  - la primera consulta de la madre y sus dos primeros hijos/as (1 h 30, etiqueta "Primera consulta");
 *  - visitas solo de la madre, de la madre con un hijo/a y de un hijo/a con la madre acompañando;
 *  - una visita sin cita de dos personas;
 *  - una visita de tres personas partida entre la primera y la segunda página de la historia
 *    (la página trae 20 consultas);
 *  - un tercer hijo agregado después, sin consultas ("Falta su primera consulta");
 *  - la próxima cita programada.
 * Todas las citas son a las 15:00 de días hábiles pasados, salvo la próxima.
 *
 * Solo se corre a mano y nunca en producción (se niega si NODE_ENV es "production"). Es
 * idempotente: si la usuaria ya existe (mismos nombres y apellidos) no hace nada. No borra ni
 * modifica filas existentes.
 *
 * Uso, desde apps/api:  npx ts-node prisma/seeds/medica-familia-demo.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';
import {
  HORARIO_MEDICINA,
  diaSemanaGT,
  hoyGT,
  parseLocalGT,
  sumarDiasGT,
} from '@akyuam/shared';

const prisma = new PrismaClient();

const DIAS_HABILES: readonly number[] = HORARIO_MEDICINA.diasLaborables;
const HORA = '15:00';

const USUARIA = {
  nombres: 'Rosa Elvira',
  apellidos: 'Ficticia Xol',
  dpi: '0000000871601',
  fechaNacimiento: '1990-06-18',
};

const HIJOS = {
  luis: {
    nombres: 'Luis Fernando',
    apellidos: 'Ficticio Xol',
    fechaNacimiento: '2018-03-02',
    genero: 'HOMBRE',
  },
  sofia: {
    nombres: 'Sofía Andrea',
    apellidos: 'Ficticia Xol',
    fechaNacimiento: '2021-01-25',
    genero: 'MUJER',
  },
  // Trabajo Social lo agregó después: nunca ha tenido consulta.
  mateo: {
    nombres: 'Mateo José',
    apellidos: 'Ficticio Xol',
    fechaNacimiento: '2023-09-10',
    genero: 'HOMBRE',
  },
} as const;

type Persona = 'usuaria' | 'luis' | 'sofia';

interface VisitaSeed {
  /** Días hábiles desde hoy (negativo = pasado). */
  dias: number;
  personas: Persona[];
  duracionMin: 30 | 60 | 90;
  sinCita?: boolean;
}

// De la más antigua a la más reciente. Contadas desde la más reciente, la visita de -32 ocupa
// las consultas 20 a 22: queda partida entre la primera y la segunda página.
const VISITAS: VisitaSeed[] = [
  { dias: -36, personas: ['usuaria', 'luis', 'sofia'], duracionMin: 90 },
  { dias: -34, personas: ['usuaria'], duracionMin: 30 },
  { dias: -32, personas: ['usuaria', 'luis', 'sofia'], duracionMin: 90 },
  { dias: -30, personas: ['usuaria'], duracionMin: 30 },
  { dias: -28, personas: ['usuaria'], duracionMin: 30 },
  { dias: -26, personas: ['usuaria', 'luis'], duracionMin: 60 },
  { dias: -24, personas: ['usuaria'], duracionMin: 30 },
  { dias: -22, personas: ['usuaria'], duracionMin: 30 },
  { dias: -20, personas: ['usuaria', 'luis'], duracionMin: 60 },
  { dias: -18, personas: ['usuaria'], duracionMin: 30 },
  { dias: -16, personas: ['usuaria', 'sofia'], duracionMin: 60 },
  { dias: -14, personas: ['usuaria'], duracionMin: 30 },
  { dias: -12, personas: ['sofia'], duracionMin: 30 },
  { dias: -10, personas: ['usuaria'], duracionMin: 30 },
  { dias: -8, personas: ['usuaria', 'luis'], duracionMin: 60, sinCita: true },
  { dias: -6, personas: ['usuaria'], duracionMin: 30 },
  { dias: -4, personas: ['luis'], duracionMin: 30 },
  { dias: -2, personas: ['usuaria'], duracionMin: 30 },
];

const PROXIMA: VisitaSeed = {
  dias: 3,
  personas: ['usuaria', 'luis'],
  duracionMin: 60,
};

const DIAGNOSTICOS: Record<Persona, string[]> = {
  usuaria: [
    'Dato ficticio: cefalea tensional',
    'Dato ficticio: gastritis aguda',
    'Dato ficticio: control de presión arterial',
    'Dato ficticio: lumbalgia mecánica',
    'Dato ficticio: insomnio de conciliación',
  ],
  luis: [
    'Dato ficticio: rinofaringitis',
    'Dato ficticio: control de niño sano',
    'Dato ficticio: dermatitis de contacto',
  ],
  sofia: [
    'Dato ficticio: control de niña sana',
    'Dato ficticio: diarrea aguda sin deshidratación',
  ],
};

/** El día hábil a `dias` días hábiles de hoy. */
function diaHabil(dias: number): string {
  let fecha = hoyGT();
  while (!DIAS_HABILES.includes(diaSemanaGT(fecha))) {
    fecha = sumarDiasGT(fecha, 1);
  }
  const paso = dias < 0 ? -1 : 1;
  for (let restantes = Math.abs(dias); restantes > 0;) {
    fecha = sumarDiasGT(fecha, paso);
    if (DIAS_HABILES.includes(diaSemanaGT(fecha))) {
      restantes -= 1;
    }
  }
  return fecha;
}

/** Signos ficticios dentro de los rangos del CHECK de la tabla. */
function signos(persona: Persona, indice: number) {
  if (persona === 'usuaria') {
    return {
      presionSistolica: 116 + (indice % 5) * 2,
      presionDiastolica: 74 + (indice % 4),
      frecuenciaCardiaca: 76 + (indice % 6),
      frecuenciaResp: 16,
      temperaturaC: new Prisma.Decimal('36.6'),
      saturacionO2: 98,
      pesoKg: new Prisma.Decimal((63 - indice * 0.2).toFixed(2)),
      tallaM: new Prisma.Decimal('1.55'),
    };
  }
  return {
    frecuenciaCardiaca: persona === 'luis' ? 92 : 104,
    temperaturaC: new Prisma.Decimal(indice % 3 === 0 ? '37.4' : '36.8'),
    pesoKg: new Prisma.Decimal(persona === 'luis' ? '26.40' : '16.80'),
    tallaM: new Prisma.Decimal(persona === 'luis' ? '1.27' : '1.02'),
  };
}

async function siguienteNumero(
  tx: Prisma.TransactionClient,
  anio: number,
): Promise<string> {
  const contador = await tx.expedienteContador.upsert({
    where: { anio },
    create: { anio, ultimo: 1 },
    update: { ultimo: { increment: 1 } },
  });
  return `${String(contador.ultimo).padStart(2, '0')}-${anio}`;
}

async function primerUsuario(
  rol: 'TRABAJO_SOCIAL' | 'MEDICA',
): Promise<string> {
  const usuario = await prisma.usuario.findFirst({
    where: { rol, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!usuario) {
    throw new Error(
      `No hay ningún usuario activo de ${rol}: corre primero prisma/seed.ts.`,
    );
  }
  return usuario.id;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Este seed es solo para desarrollo: no corre en producción.',
    );
  }
  const nombre = `${USUARIA.nombres} ${USUARIA.apellidos}`;
  const existente = await prisma.usuaria.findFirst({
    where: { nombres: USUARIA.nombres, apellidos: USUARIA.apellidos },
    select: { id: true },
  });
  if (existente) {
    console.log(`Ya existe, se omite: ${nombre}`);
    return;
  }
  const trabajoSocialId = await primerUsuario('TRABAJO_SOCIAL');
  const medicaId = await primerUsuario('MEDICA');

  const numero = await prisma.$transaction(
    async (tx) => {
      const usuaria = await tx.usuaria.create({
        data: {
          nombres: USUARIA.nombres,
          apellidos: USUARIA.apellidos,
          dpi: USUARIA.dpi,
          fechaNacimiento: new Date(USUARIA.fechaNacimiento),
          grupoEtnico: 'MAYA_QECHI',
          municipio: 'COBAN',
          telefono: '00000000',
        },
      });
      const fechaCaso = diaHabil(VISITAS[0].dias - 1);
      const numero = await siguienteNumero(tx, Number(fechaCaso.slice(0, 4)));
      const expediente = await tx.expediente.create({
        data: {
          numero,
          usuariaId: usuaria.id,
          fecha: new Date(fechaCaso),
          tipoRegistro: 'EXTERNA',
          tipologiaDelito: ['FISICA', 'PSICOLOGICA'],
          creadoPorId: trabajoSocialId,
        },
      });
      const ninoId: Record<Persona, string | null> = {
        usuaria: null,
        luis: null,
        sofia: null,
      };
      for (const clave of ['luis', 'sofia', 'mateo'] as const) {
        const hijo = HIJOS[clave];
        const creado = await tx.nino.create({
          data: {
            expedienteId: expediente.id,
            nombres: hijo.nombres,
            apellidos: hijo.apellidos,
            fechaNacimiento: new Date(hijo.fechaNacimiento),
            genero: hijo.genero,
          },
        });
        if (clave !== 'mateo') ninoId[clave] = creado.id;
      }
      const referidoEn = parseLocalGT(`${fechaCaso}T07:30`);
      const referido = await tx.referidoArea.create({
        data: {
          expedienteId: expediente.id,
          area: 'MEDICA',
          otorgadoPorId: trabajoSocialId,
          motivo:
            'Dato ficticio: madre e hijos/as referidos para evaluación médica.',
          createdAt: referidoEn,
        },
      });
      const atencion = await tx.atencionMedica.create({
        data: {
          expedienteId: expediente.id,
          consecutivo: 1,
          referidoId: referido.id,
          medicaId,
          fechaInicio: new Date(fechaCaso),
          creadoPorId: medicaId,
          createdAt: new Date(referidoEn.getTime() + 60 * 60 * 1000),
        },
      });

      const usadas: Record<Persona, number> = { usuaria: 0, luis: 0, sofia: 0 };
      for (const visita of [...VISITAS, PROXIMA]) {
        const inicio = parseLocalGT(`${diaHabil(visita.dias)}T${HORA}`);
        const proxima = visita === PROXIMA;
        const cita = visita.sinCita
          ? null
          : await tx.citaMedica.create({
              data: {
                atencionId: atencion.id,
                inicio,
                duracionMin: visita.duracionMin,
                estado: proxima ? 'PROGRAMADA' : 'ATENDIDA',
                creadoPorId: medicaId,
                personas: {
                  create: visita.personas.map((p) => ({ ninoId: ninoId[p] })),
                },
              },
            });
        if (proxima) continue;
        for (const persona of visita.personas) {
          const indice = usadas[persona]++;
          const opciones = DIAGNOSTICOS[persona];
          await tx.consultaMedica.create({
            data: {
              atencionId: atencion.id,
              citaId: cita?.id ?? null,
              ninoId: ninoId[persona],
              fechaHora: inicio,
              motivoConsulta: 'Dato ficticio: motivo de la consulta.',
              ...signos(persona, indice),
              diagnostico: opciones[indice % opciones.length],
              planTratamiento: 'Dato ficticio: plan de tratamiento.',
              recetaLaboratorios: 'Dato ficticio: receta y laboratorios.',
              registradaPorId: medicaId,
              createdAt: new Date(inicio.getTime() + 20 * 60 * 1000),
            },
          });
        }
      }
      return numero;
    },
    { timeout: 30_000 },
  );
  console.log(`Creada: ${nombre} — expediente ${numero}`);
}

main()
  .catch((error: unknown) => {
    // Lo más probable: una cita choca con otra ya agendada a las 15:00 ese día. La transacción
    // se revierte entera, así que no queda nada a medias.
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
