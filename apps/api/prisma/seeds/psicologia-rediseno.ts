/**
 * Usuarias FICTICIAS de Psicología para desarrollo. Ningún dato corresponde a una persona real:
 * los nombres llevan "Ficticia", los DPI son ceros y todo texto clínico dice "Dato ficticio".
 *
 * Deja un caso de cada situación del rediseño, con fechas relativas al día en que se corre:
 *  - referencia sin tomar (una reciente y una con varios días de espera, con hijo/a);
 *  - caso tomado y todavía por agendar;
 *  - proceso en Inicio con su primera cita mañana;
 *  - proceso en Seguimiento con cita hoy (una de las sesiones fue de un hijo/a);
 *  - proceso en Seguimiento sin próxima cita y con una cita de ayer sin registrar;
 *  - proceso cerrado.
 * Los casos tomados quedan a nombre de la primera cuenta de Psicología que exista.
 *
 * Solo se corre a mano y nunca en producción (se niega si NODE_ENV es "production"). Es
 * idempotente: una usuaria que ya existe (mismos nombres y apellidos) se omite, así que
 * correrlo dos veces no duplica ni reinicia nada. No borra ni modifica filas existentes.
 *
 * Uso, desde apps/api:  npx ts-node prisma/seeds/psicologia-rediseno.ts
 */
import {
  Prisma,
  PrismaClient,
  type EstadoAtencionPsicologica,
  type EstadoCitaPsicologica,
  type GrupoEtnico,
  type MotivoCierrePsicologia,
  type MunicipioAltaVerapaz,
  type TipologiaDelito,
} from '@prisma/client';
import { hoyGT, parseLocalGT, sumarDiasGT } from '@akyuam/shared';

const prisma = new PrismaClient();

/** Instante de un día relativo a hoy (en Guatemala) a una hora local "HH:mm". */
function instante(diasDesdeHoy: number, hora: string): Date {
  return parseLocalGT(`${sumarDiasGT(hoyGT(), diasDesdeHoy)}T${hora}`);
}

interface CitaSeed {
  dias: number;
  hora: string;
  estado: EstadoCitaPsicologica;
  duracionMinutos?: number;
  /** La cita es del hijo/a registrado en el expediente, no de la usuaria. */
  deNino?: boolean;
}

interface CasoSeed {
  nombres: string;
  apellidos: string;
  dpi: string;
  fechaNacimiento: string;
  grupoEtnico: GrupoEtnico;
  municipio: MunicipioAltaVerapaz;
  tipologia: TipologiaDelito[];
  /** Hace cuántos días la refirió Trabajo Social. */
  referidaHaceDias: number;
  nino?: { nombres: string; apellidos: string; fechaNacimiento: string };
  /** Sin esto la referencia queda sin tomar, visible para todas las psicólogas. */
  tomadaHaceDias?: number;
  /** Sin citas el caso queda tomado "por agendar": todavía no hay proceso abierto. */
  citas?: CitaSeed[];
  cierre?: {
    haceDias: number;
    motivo: MotivoCierrePsicologia;
    resumen: string;
  };
}

// DPI con ceros a propósito: no corresponden a ningún documento real.
const CASOS: CasoSeed[] = [
  {
    nombres: 'Rosa Amelia',
    apellidos: 'Ficticia Tzib',
    dpi: '0000000711601',
    fechaNacimiento: '1994-05-17',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    tipologia: ['PSICOLOGICA'],
    referidaHaceDias: 1,
  },
  {
    nombres: 'Gloria Estela',
    apellidos: 'Ficticia Xol',
    dpi: '0000000721601',
    fechaNacimiento: '1988-09-02',
    grupoEtnico: 'MAYA_POQOMCHI',
    municipio: 'TACTIC',
    tipologia: ['FISICA', 'PSICOLOGICA'],
    referidaHaceDias: 7,
    nino: {
      nombres: 'Niña',
      apellidos: 'Ficticia Xol',
      fechaNacimiento: '2018-03-11',
    },
  },
  {
    nombres: 'Sandra Beatriz',
    apellidos: 'Ficticia Cuc',
    dpi: '0000000731601',
    fechaNacimiento: '1990-12-24',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'SAN_CRISTOBAL_VERAPAZ',
    tipologia: ['PSICOLOGICA'],
    referidaHaceDias: 3,
    tomadaHaceDias: 1,
  },
  {
    nombres: 'Irma Yolanda',
    apellidos: 'Ficticia Coy',
    dpi: '0000000741601',
    fechaNacimiento: '1997-02-08',
    grupoEtnico: 'LADINO',
    municipio: 'COBAN',
    tipologia: ['SEXUAL'],
    referidaHaceDias: 4,
    tomadaHaceDias: 3,
    citas: [
      { dias: 1, hora: '09:00', estado: 'PROGRAMADA', duracionMinutos: 60 },
    ],
  },
  {
    nombres: 'Olga Marina',
    apellidos: 'Ficticia Tiul',
    dpi: '0000000751601',
    fechaNacimiento: '1985-06-30',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    tipologia: ['FISICA', 'PSICOLOGICA'],
    referidaHaceDias: 40,
    tomadaHaceDias: 38,
    nino: {
      nombres: 'Niño',
      apellidos: 'Ficticio Tiul',
      fechaNacimiento: '2016-08-19',
    },
    citas: [
      { dias: -35, hora: '10:00', estado: 'ATENDIDA', duracionMinutos: 60 },
      { dias: -28, hora: '10:00', estado: 'ATENDIDA' },
      { dias: -21, hora: '10:00', estado: 'NO_ASISTIO' },
      { dias: -14, hora: '10:00', estado: 'ATENDIDA', deNino: true },
      { dias: 0, hora: '15:00', estado: 'PROGRAMADA' },
    ],
  },
  {
    nombres: 'Vilma Consuelo',
    apellidos: 'Ficticia Pacay',
    dpi: '0000000761601',
    fechaNacimiento: '1979-10-05',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'TACTIC',
    tipologia: ['PSICOLOGICA', 'ECONOMICA_PATRIMONIAL'],
    referidaHaceDias: 30,
    tomadaHaceDias: 29,
    citas: [
      { dias: -24, hora: '14:00', estado: 'ATENDIDA', duracionMinutos: 90 },
      { dias: -10, hora: '14:00', estado: 'ATENDIDA' },
      // Ya pasó y nadie registró sesión ni inasistencia → "Sin registrar".
      { dias: -1, hora: '14:00', estado: 'PROGRAMADA' },
    ],
  },
  {
    nombres: 'Celia Margarita',
    apellidos: 'Ficticia Caz',
    dpi: '0000000771601',
    fechaNacimiento: '1992-01-15',
    grupoEtnico: 'MAYA_POQOMCHI',
    municipio: 'SAN_CRISTOBAL_VERAPAZ',
    tipologia: ['PSICOLOGICA'],
    referidaHaceDias: 120,
    tomadaHaceDias: 118,
    citas: [
      { dias: -110, hora: '09:00', estado: 'ATENDIDA', duracionMinutos: 60 },
      { dias: -90, hora: '09:00', estado: 'ATENDIDA' },
      { dias: -60, hora: '09:00', estado: 'ATENDIDA' },
    ],
    cierre: {
      haceDias: 45,
      motivo: 'OBJETIVOS_CUMPLIDOS',
      resumen: 'Dato ficticio: se cumplieron los objetivos acordados.',
    },
  },
];

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
  psicologaId: string,
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
      },
    });

    const fechaCaso = sumarDiasGT(hoyGT(), -datos.referidaHaceDias);
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
    const referido = await tx.referidoArea.create({
      data: {
        expedienteId: expediente.id,
        area: 'PSICOLOGIA',
        otorgadoPorId: trabajoSocialId,
        motivo: 'Dato ficticio: referida para acompañamiento psicológico.',
        createdAt: instante(-datos.referidaHaceDias, '10:00'),
      },
    });

    if (datos.tomadaHaceDias === undefined) {
      return numero;
    }

    const citas = datos.citas ?? [];
    const tomadaEn = instante(-datos.tomadaHaceDias, '11:00');
    // El proceso se abre al programar la primera cita, que aquí se agenda el día que se toma.
    const abiertoEn = citas.length > 0 ? tomadaEn : null;
    const primeraAtendida = citas.find((cita) => cita.estado === 'ATENDIDA');
    const estado: EstadoAtencionPsicologica = datos.cierre
      ? 'CIERRE'
      : primeraAtendida
        ? 'SEGUIMIENTO'
        : 'INICIO';

    const atencion = await tx.atencionPsicologica.create({
      data: {
        expedienteId: expediente.id,
        referidoId: referido.id,
        consecutivo: 1,
        estado,
        psicologaAsignadaId: psicologaId,
        tomadaEn,
        fechaInicio: abiertoEn,
        fechaCierre: datos.cierre
          ? instante(-datos.cierre.haceDias, '16:00')
          : null,
        motivoCierreCatalogo: datos.cierre?.motivo,
        resumenCierre: datos.cierre?.resumen,
        actualizadoPorId: psicologaId,
        createdAt: tomadaEn,
      },
    });

    if (abiertoEn) {
      const hitos: {
        anterior: EstadoAtencionPsicologica | null;
        nuevo: EstadoAtencionPsicologica;
        en: Date;
      }[] = [{ anterior: null, nuevo: 'INICIO', en: abiertoEn }];
      if (primeraAtendida) {
        hitos.push({
          anterior: 'INICIO',
          nuevo: 'SEGUIMIENTO',
          en: instante(primeraAtendida.dias, primeraAtendida.hora),
        });
      }
      if (datos.cierre) {
        hitos.push({
          anterior: 'SEGUIMIENTO',
          nuevo: 'CIERRE',
          en: instante(-datos.cierre.haceDias, '16:00'),
        });
      }
      await tx.cambioEstadoAtencion.createMany({
        data: hitos.map((hito) => ({
          atencionId: atencion.id,
          estadoAnterior: hito.anterior,
          estadoNuevo: hito.nuevo,
          registradoPorId: psicologaId,
          createdAt: hito.en,
        })),
      });
    }

    await tx.citaPsicologica.createMany({
      data: citas.map((cita, indice) => ({
        atencionId: atencion.id,
        fechaHora: instante(cita.dias, cita.hora),
        duracionMinutos: cita.duracionMinutos ?? 45,
        tipo: indice === 0 ? 'PRIMERA_ATENCION' : 'SEGUIMIENTO',
        estado: cita.estado,
        ninoId: cita.deNino ? (expediente.ninos[0]?.id ?? null) : null,
        temas:
          cita.estado === 'ATENDIDA'
            ? 'Dato ficticio: temas abordados en la sesión.'
            : null,
        acuerdos:
          cita.estado === 'ATENDIDA'
            ? 'Dato ficticio: acuerdos de la sesión.'
            : null,
        atendidoPorId: psicologaId,
        createdAt: tomadaEn,
      })),
    });

    return numero;
  });
}

async function primerUsuario(
  rol: 'TRABAJO_SOCIAL' | 'PSICOLOGIA',
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
  const psicologaId = await primerUsuario('PSICOLOGIA');

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
    const numero = await crearCaso(datos, trabajoSocialId, psicologaId);
    console.log(`Creada: ${nombre} — expediente ${numero}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
