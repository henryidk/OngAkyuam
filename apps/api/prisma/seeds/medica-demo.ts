/**
 * Pacientes FICTICIAS de Medicina para desarrollo. Ningún dato corresponde a una persona real:
 * los apellidos llevan "Ficticia", los DPI son ceros y todo texto clínico dice "Dato ficticio".
 *
 * Deja un caso de cada situación del módulo, con fechas relativas al día en que se corre (las
 * citas caen siempre en día hábil y dentro del horario de la médica):
 *  - dos referencias pendientes de primera consulta (una reciente con hijo/a, otra con días);
 *  - atención activa con consultas previas y cita el próximo día hábil;
 *  - atención activa con una cita pasada sin registrar y sin próxima cita;
 *  - atención activa con una inasistencia que todavía se puede reprogramar;
 *  - atención de alta, visible para Jurídico y Psicología.
 * Las atenciones quedan a nombre de la primera cuenta de Medicina que exista.
 *
 * Solo se corre a mano y nunca en producción (se niega si NODE_ENV es "production"). Es
 * idempotente: una usuaria que ya existe (mismos nombres y apellidos) se omite, así que
 * correrlo dos veces no duplica ni reinicia nada. No borra ni modifica filas existentes.
 *
 * Uso, desde apps/api:  npx ts-node prisma/seeds/medica-demo.ts
 */
import {
  Prisma,
  PrismaClient,
  type EstadoCitaMedica,
  type GrupoEtnico,
  type MotivoAltaMedica,
  type MunicipioAltaVerapaz,
  type TipologiaDelito,
} from '@prisma/client';
import {
  HORARIO_MEDICINA,
  diaSemanaGT,
  hoyGT,
  parseLocalGT,
  sumarDiasGT,
} from '@akyuam/shared';

const prisma = new PrismaClient();

const DIAS_HABILES: readonly number[] = HORARIO_MEDICINA.diasLaborables;

/**
 * El día hábil a `dias` días hábiles de hoy (0 = hoy si es hábil; si no, el siguiente). Contar
 * en días hábiles evita citas en fin de semana, que el sistema no admite.
 */
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

function instante(fecha: string, hora: string): Date {
  return parseLocalGT(`${fecha}T${hora}`);
}

interface CitaSeed {
  /** Días hábiles desde hoy. */
  dias: number;
  hora: string;
  estado: EstadoCitaMedica;
  deNino?: boolean;
}

interface CasoSeed {
  nombres: string;
  apellidos: string;
  dpi: string;
  fechaNacimiento: string;
  grupoEtnico: GrupoEtnico;
  municipio: MunicipioAltaVerapaz | null;
  tipologia: TipologiaDelito[];
  /** Hace cuántos días hábiles la refirió Trabajo Social. */
  referidaHace: number;
  nino?: { nombres: string; apellidos: string; fechaNacimiento: string };
  /** Sin citas la referencia queda pendiente de primera consulta. */
  citas?: CitaSeed[];
  alta?: { motivo: MotivoAltaMedica; nota?: string };
  visible?: boolean;
}

// DPI con ceros a propósito: no corresponden a ningún documento real. Cada caso usa horas
// distintas para no chocar con el índice de un solo turno por horario.
const CASOS: CasoSeed[] = [
  {
    nombres: 'Marta Lidia',
    apellidos: 'Ficticia Choc',
    dpi: '0000000811601',
    fechaNacimiento: '1991-04-09',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    tipologia: ['FISICA'],
    referidaHace: 0,
    nino: {
      nombres: 'Niña',
      apellidos: 'Ficticia Choc',
      fechaNacimiento: '2019-07-21',
    },
  },
  {
    nombres: 'Ana Patricia',
    apellidos: 'Ficticia Maquín',
    dpi: '0000000821601',
    fechaNacimiento: '1983-11-30',
    grupoEtnico: 'MAYA_POQOMCHI',
    municipio: 'TACTIC',
    tipologia: ['FISICA', 'SEXUAL'],
    referidaHace: 6,
  },
  {
    nombres: 'Lucía Fernanda',
    apellidos: 'Ficticia Bol',
    dpi: '0000000831601',
    fechaNacimiento: '1996-02-14',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'SAN_CRISTOBAL_VERAPAZ',
    tipologia: ['FISICA', 'PSICOLOGICA'],
    referidaHace: 25,
    nino: {
      nombres: 'Niño',
      apellidos: 'Ficticio Bol',
      fechaNacimiento: '2017-01-05',
    },
    citas: [
      { dias: -20, hora: '08:30', estado: 'ATENDIDA' },
      { dias: -10, hora: '08:30', estado: 'ATENDIDA', deNino: true },
      { dias: -5, hora: '08:30', estado: 'ATENDIDA' },
      { dias: 1, hora: '09:30', estado: 'PROGRAMADA' },
    ],
  },
  {
    nombres: 'Elena Isabel',
    apellidos: 'Ficticia Caal',
    dpi: '0000000841601',
    fechaNacimiento: '1979-08-03',
    grupoEtnico: 'LADINO',
    municipio: null,
    tipologia: ['ECONOMICA_PATRIMONIAL', 'FISICA'],
    referidaHace: 15,
    citas: [
      { dias: -12, hora: '10:30', estado: 'ATENDIDA' },
      // Ya pasó y nadie registró consulta ni inasistencia → "Sin registrar".
      { dias: -1, hora: '10:30', estado: 'PROGRAMADA' },
    ],
  },
  {
    nombres: 'Juana Carolina',
    apellidos: 'Ficticia Tun',
    dpi: '0000000851601',
    fechaNacimiento: '2001-05-27',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    tipologia: ['SEXUAL'],
    referidaHace: 9,
    citas: [
      { dias: -7, hora: '14:30', estado: 'ATENDIDA' },
      { dias: -2, hora: '14:30', estado: 'NO_ASISTIO' },
    ],
  },
  {
    nombres: 'Rebeca Noemí',
    apellidos: 'Ficticia Pop',
    dpi: '0000000861601',
    fechaNacimiento: '1988-12-12',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    tipologia: ['FISICA'],
    referidaHace: 60,
    citas: [
      { dias: -55, hora: '11:00', estado: 'ATENDIDA' },
      { dias: -40, hora: '11:00', estado: 'ATENDIDA' },
    ],
    alta: { motivo: 'ALTA_MEDICA' },
    visible: true,
  },
];

/** Signos vitales ficticios dentro de los rangos del CHECK de la tabla. */
function signosFicticios(indice: number, deNino: boolean) {
  return deNino
    ? {
        frecuenciaCardiaca: 96,
        temperaturaC: new Prisma.Decimal('36.8'),
        pesoKg: new Prisma.Decimal('24.50'),
        tallaM: new Prisma.Decimal('1.22'),
      }
    : {
        presionSistolica: 118 + indice * 2,
        presionDiastolica: 76 + indice,
        frecuenciaCardiaca: 78 - indice,
        frecuenciaResp: 16,
        temperaturaC: new Prisma.Decimal('36.6'),
        saturacionO2: 98,
        glucosaMgDl: 92 + indice * 3,
        pesoKg: new Prisma.Decimal((61 - indice * 0.4).toFixed(2)),
        tallaM: new Prisma.Decimal('1.56'),
      };
}

/** Misma numeración que usa el sistema, para no chocar con expedientes creados después. */
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

async function crearCaso(
  datos: CasoSeed,
  trabajoSocialId: string,
  medicaId: string,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const usuaria = await tx.usuaria.create({
      data: {
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        dpi: datos.dpi,
        fechaNacimiento: new Date(datos.fechaNacimiento),
        grupoEtnico: datos.grupoEtnico,
        municipio: datos.municipio,
        departamentoOtro: datos.municipio ? null : 'Dato ficticio',
        municipioOtro: datos.municipio ? null : 'Dato ficticio',
      },
    });

    const fechaCaso = diaHabil(-datos.referidaHace);
    const numero = await siguienteNumero(tx, Number(fechaCaso.slice(0, 4)));
    const expediente = await tx.expediente.create({
      data: {
        numero,
        usuariaId: usuaria.id,
        fecha: new Date(fechaCaso),
        tipoRegistro: 'EXTERNA',
        tipologiaDelito: datos.tipologia,
        creadoPorId: trabajoSocialId,
        ninos: datos.nino
          ? {
              create: {
                nombres: datos.nino.nombres,
                apellidos: datos.nino.apellidos,
                fechaNacimiento: new Date(datos.nino.fechaNacimiento),
                genero: 'MUJER',
              },
            }
          : undefined,
      },
      include: { ninos: { select: { id: true } } },
    });
    const referidoEn = instante(fechaCaso, '07:30');
    const referido = await tx.referidoArea.create({
      data: {
        expedienteId: expediente.id,
        area: 'MEDICA',
        otorgadoPorId: trabajoSocialId,
        motivo: 'Dato ficticio: referida para evaluación médica.',
        createdAt: referidoEn,
      },
    });

    const citas = datos.citas ?? [];
    if (citas.length === 0) {
      return numero;
    }

    // La atención se abre al programar la primera cita: aquí, el mismo día de la referencia.
    const ultimaAtendida = [...citas]
      .reverse()
      .find((cita) => cita.estado === 'ATENDIDA');
    const atencion = await tx.atencionMedica.create({
      data: {
        expedienteId: expediente.id,
        consecutivo: 1,
        estado: datos.alta ? 'ALTA' : 'ACTIVA',
        referidoId: referido.id,
        medicaId,
        fechaInicio: new Date(fechaCaso),
        fechaAlta:
          datos.alta && ultimaAtendida
            ? new Date(diaHabil(ultimaAtendida.dias + 1))
            : null,
        motivoAlta: datos.alta?.motivo,
        notaAlta: datos.alta?.nota,
        visibleJuridico: datos.visible ?? false,
        visiblePsicologia: datos.visible ?? false,
        creadoPorId: medicaId,
        createdAt: new Date(referidoEn.getTime() + 60 * 60 * 1000),
      },
    });

    let indice = 0;
    for (const cita of citas) {
      const inicio = instante(diaHabil(cita.dias), cita.hora);
      const ninoId = cita.deNino ? (expediente.ninos[0]?.id ?? null) : null;
      const creada = await tx.citaMedica.create({
        data: {
          atencionId: atencion.id,
          ninoId,
          inicio,
          estado: cita.estado,
          creadoPorId: medicaId,
          createdAt: atencion.createdAt,
        },
      });
      if (cita.estado === 'ATENDIDA') {
        await tx.consultaMedica.create({
          data: {
            atencionId: atencion.id,
            citaId: creada.id,
            ninoId,
            fechaHora: inicio,
            motivoConsulta: 'Dato ficticio: motivo de la consulta.',
            ...signosFicticios(indice, cita.deNino ?? false),
            diagnostico: 'Dato ficticio: diagnóstico de la consulta.',
            planTratamiento: 'Dato ficticio: plan de tratamiento.',
            recetaLaboratorios: 'Dato ficticio: receta y laboratorios.',
            registradaPorId: medicaId,
            createdAt: new Date(inicio.getTime() + 30 * 60 * 1000),
          },
        });
        indice += 1;
      }
    }
    return numero;
  });
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
      `No hay ningún usuario activo de ${rol}: corre primero el seed de usuarios (prisma/seed.ts).`,
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

  const trabajoSocialId = await primerUsuario('TRABAJO_SOCIAL');
  const medicaId = await primerUsuario('MEDICA');

  for (const datos of CASOS) {
    const nombre = `${datos.nombres} ${datos.apellidos}`;
    const existente = await prisma.usuaria.findFirst({
      where: { nombres: datos.nombres, apellidos: datos.apellidos },
      select: { id: true },
    });
    if (existente) {
      console.log(`Ya existe, se omite: ${nombre}`);
      continue;
    }
    try {
      const numero = await crearCaso(datos, trabajoSocialId, medicaId);
      console.log(`Creada: ${nombre} — expediente ${numero}`);
    } catch (error) {
      // Lo más probable: una cita choca con otra ya agendada en ese horario. La transacción
      // se revierte entera, así que no queda nada a medias.
      console.error(`No se pudo crear ${nombre}:`, error);
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
