/**
 * Usuarias FICTICIAS de Psicología para ver con volumen la lista de usuarias y los reportes
 * (paginación de 20 y de 25, filtros, desgloses). Ningún dato corresponde a una persona real:
 * los apellidos empiezan con "Ficticia", los DPI son ceros y todo texto clínico dice
 * "Dato ficticio".
 *
 * Crea 46 usuarias con fechas relativas al día en que se corre (todas dentro de los últimos
 * ~300 días):
 *  - 6 referencias sin tomar;
 *  - 40 procesos repartidos entre las dos primeras cuentas de Psicología, con sesiones semanales,
 *    alguna inasistencia, clínica 1 o 2, diagnóstico y enfoque;
 *  - 1 de cada 5 procesos cerrado (motivo rotando por el catálogo);
 *  - 1 de cada 7 usuarias con un hijo/a que tiene su propio proceso.
 *
 * Solo se corre a mano y nunca en producción (se niega si NODE_ENV es "production"). Es
 * idempotente: una usuaria que ya existe (mismos nombres y apellidos) se omite. No borra ni
 * modifica filas existentes.
 *
 * Uso, desde apps/api:  npx ts-node prisma/seeds/psicologia-reportes-demo.ts
 */
import {
  PrismaClient,
  type ClinicaPsicologia,
  type EstadoAtencionPsicologica,
  type EstadoCitaPsicologica,
  type GrupoEtnico,
  type MotivoCierrePsicologia,
  type MunicipioAltaVerapaz,
  type Prisma,
  type TipologiaDelito,
} from '@prisma/client';
import { hoyGT, parseLocalGT, sumarDiasGT } from '@akyuam/shared';
import { siguienteNumeroExpediente } from './compartido/expediente';

const prisma = new PrismaClient();

const TOTAL_USUARIAS = 46;
const SIN_TOMAR = 6;

const NOMBRES = [
  'Ana Lucía',
  'Berta Alicia',
  'Carmen Rosa',
  'Dora Elena',
  'Elvira Judith',
  'Flor de María',
  'Gladys Noemí',
  'Hilda Marisol',
  'Isabel Cristina',
  'Juana Petrona',
  'Karla Patricia',
  'Lidia Esperanza',
  'María José',
  'Nidia Carolina',
  'Otilia Ester',
  'Paula Andrea',
];
const APELLIDOS = [
  'Tzul',
  'Caal',
  'Bol',
  'Pop',
  'Ical',
  'Maquín',
  'Chen',
  'Tot',
  'Sacul',
  'Botzoc',
  'Cucul',
  'Xuc',
];
const ETNIAS: GrupoEtnico[] = [
  'MAYA',
  'MAYA',
  'MAYA',
  'LADINO',
  'MAYA',
  'OTRO',
];
const MUNICIPIOS: MunicipioAltaVerapaz[] = [
  'COBAN',
  'SAN_PEDRO_CARCHA',
  'SAN_JUAN_CHAMELCO',
  'TACTIC',
  'SAN_CRISTOBAL_VERAPAZ',
  'COBAN',
  'SENAHU',
  'CHISEC',
];
const TIPOLOGIAS: TipologiaDelito[][] = [
  ['PSICOLOGICA'],
  ['FISICA', 'PSICOLOGICA'],
  ['SEXUAL'],
  ['PSICOLOGICA', 'ECONOMICA_PATRIMONIAL'],
  ['FISICA'],
];
const DIAGNOSTICOS = [
  'Dato ficticio: ansiedad generalizada',
  'Dato ficticio: estrés postraumático',
  'Dato ficticio: episodio depresivo leve',
  'Dato ficticio: duelo',
  'Dato ficticio: baja autoestima asociada a violencia',
];
const ENFOQUES = [
  'Dato ficticio: cognitivo-conductual',
  'Dato ficticio: sistémico',
  'Dato ficticio: humanista',
];
const MOTIVOS: MotivoCierrePsicologia[] = [
  'OBJETIVOS_CUMPLIDOS',
  'DEJO_DE_ASISTIR',
  'REFERIDA_OTRA_INSTITUCION',
  'DECISION_USUARIA',
  'OTRO',
];

const elegir = <T>(lista: T[], i: number): T => lista[i % lista.length];

/** Instante de un día relativo a hoy (en Guatemala) a una hora local "HH:mm". */
function instante(diasDesdeHoy: number, hora: string): Date {
  return parseLocalGT(`${sumarDiasGT(hoyGT(), diasDesdeHoy)}T${hora}`);
}

interface CitaSeed {
  dias: number;
  estado: EstadoCitaPsicologica;
}

/** Sesiones semanales desde `inicio` (días relativos a hoy); nunca pasa de hoy salvo la próxima. */
function sesiones(
  inicio: number,
  cantidad: number,
  i: number,
  conProxima: boolean,
): CitaSeed[] {
  const citas: CitaSeed[] = [];
  for (let s = 0; s < cantidad; s++) {
    const dias = inicio + s * 7;
    if (dias > -1) break;
    // La primera siempre atendida; de vez en cuando una inasistencia.
    citas.push({
      dias,
      estado: s > 0 && (s + i) % 4 === 0 ? 'NO_ASISTIO' : 'ATENDIDA',
    });
  }
  if (conProxima) citas.push({ dias: 2 + (i % 5), estado: 'PROGRAMADA' });
  return citas;
}

interface ProcesoSeed {
  psicologaId: string;
  ninoId: string | null;
  referidoId: string;
  expedienteId: string;
  citas: CitaSeed[];
  cierre: { dias: number; motivo: MotivoCierrePsicologia } | null;
  i: number;
}

async function crearProceso(
  tx: Prisma.TransactionClient,
  p: ProcesoSeed,
): Promise<void> {
  const primera = p.citas[0];
  const abiertoEn = instante(primera.dias - 2, '11:00');
  const primeraAtendida = p.citas.find((cita) => cita.estado === 'ATENDIDA');
  const estado: EstadoAtencionPsicologica = p.cierre
    ? 'CIERRE'
    : primeraAtendida
      ? 'SEGUIMIENTO'
      : 'INICIO';
  const clinica: ClinicaPsicologia = p.i % 3 === 0 ? 'CLINICA_2' : 'CLINICA_1';
  const hora = `${String(8 + (p.i % 8)).padStart(2, '0')}:00`;

  const atencion = await tx.atencionPsicologica.create({
    data: {
      expedienteId: p.expedienteId,
      ninoId: p.ninoId,
      referidoId: p.referidoId,
      consecutivo: 1,
      estado,
      psicologaAsignadaId: p.psicologaId,
      tomadaEn: abiertoEn,
      fechaInicio: abiertoEn,
      fechaCierre: p.cierre ? instante(p.cierre.dias, '16:00') : null,
      motivoCierreCatalogo: p.cierre?.motivo,
      resumenCierre: p.cierre ? 'Dato ficticio: resumen del cierre.' : null,
      actualizadoPorId: p.psicologaId,
      createdAt: abiertoEn,
    },
  });

  const hitos: {
    anterior: EstadoAtencionPsicologica | null;
    nuevo: EstadoAtencionPsicologica;
    en: Date;
  }[] = [{ anterior: null, nuevo: 'INICIO', en: abiertoEn }];
  if (primeraAtendida) {
    hitos.push({
      anterior: 'INICIO',
      nuevo: 'SEGUIMIENTO',
      en: instante(primeraAtendida.dias, hora),
    });
  }
  if (p.cierre) {
    hitos.push({
      anterior: 'SEGUIMIENTO',
      nuevo: 'CIERRE',
      en: instante(p.cierre.dias, '16:00'),
    });
  }
  await tx.cambioEstadoAtencion.createMany({
    data: hitos.map((hito) => ({
      atencionId: atencion.id,
      estadoAnterior: hito.anterior,
      estadoNuevo: hito.nuevo,
      registradoPorId: p.psicologaId,
      createdAt: hito.en,
    })),
  });

  await tx.citaPsicologica.createMany({
    data: p.citas.map((cita, indice) => {
      const atendida = cita.estado === 'ATENDIDA';
      return {
        atencionId: atencion.id,
        ninoId: p.ninoId,
        fechaHora: instante(cita.dias, hora),
        duracionMinutos: indice === 0 ? 60 : 45,
        tipo: indice === 0 ? 'PRIMERA_ATENCION' : 'SEGUIMIENTO',
        estado: cita.estado,
        clinica: atendida ? clinica : null,
        temas: atendida ? 'Dato ficticio: temas abordados en la sesión.' : null,
        acuerdos: atendida ? 'Dato ficticio: acuerdos de la sesión.' : null,
        diagnostico: atendida
          ? elegir(DIAGNOSTICOS, p.i + (p.ninoId ? 3 : 0))
          : null,
        enfoqueTerapeutico: atendida ? elegir(ENFOQUES, p.i) : null,
        // Obligatoria en toda sesión atendida (CitaPsicologica_atencion_brindada_chk).
        atencionBrindada: atendida
          ? 'Dato ficticio: escucha activa y contención emocional.'
          : null,
        atendidoPorId: p.psicologaId,
        createdAt: abiertoEn,
      };
    }),
  });
}

async function crearCaso(
  i: number,
  nombres: string,
  apellidos: string,
  trabajoSocialId: string,
  psicologas: string[],
): Promise<string> {
  const inicio = -300 + (i - SIN_TOMAR) * 6; // primera sesión: escalonadas a lo largo del año
  const referidaHaceDias = i <= SIN_TOMAR ? i * 2 : -inicio + 5;
  const conHijo = i % 7 === 0;

  return prisma.$transaction(async (tx) => {
    const usuaria = await tx.usuaria.create({
      data: {
        areaResidencia: i % 3 === 0 ? 'URBANA' : 'RURAL',
        ocupacion: 'Dato ficticio',
        nombres,
        apellidos,
        // 13 dígitos con ceros: no corresponde a ningún documento real.
        dpi: `00000009${String(i).padStart(2, '0')}601`,
        fechaNacimiento: new Date(
          `${1970 + (i % 35)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
        ),
        grupoEtnico: elegir(ETNIAS, i),
        municipio: elegir(MUNICIPIOS, i),
      },
    });

    const fechaCaso = sumarDiasGT(hoyGT(), -referidaHaceDias);
    const numero = await siguienteNumeroExpediente(
      tx,
      Number(fechaCaso.slice(0, 4)),
    );
    const expediente = await tx.expediente.create({
      data: {
        condicionMaternidad: 'NORMAL',
        idiomaAtencion: i % 2 === 0 ? 'QEQCHI' : 'ESPANOL',
        numero,
        usuariaId: usuaria.id,
        fecha: new Date(fechaCaso),
        tipoRegistro: 'EXTERNA',
        tipologiaDelito: elegir(TIPOLOGIAS, i),
        creadoPorId: trabajoSocialId,
        ninos: conHijo
          ? {
              create: {
                hijo: {
                  create: {
                    usuaria: { connect: { id: usuaria.id } },
                    nombres: i % 2 === 0 ? 'Niña' : 'Niño',
                    apellidos,
                    fechaNacimiento: new Date(`${2014 + (i % 8)}-06-10`),
                    genero: i % 2 === 0 ? 'MUJER' : 'HOMBRE',
                  },
                },
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
        createdAt: instante(-referidaHaceDias, '10:00'),
      },
    });

    if (i <= SIN_TOMAR) return numero;

    const psicologaId = elegir(psicologas, i);
    const cerrado = i % 5 === 0;
    const cantidad = 3 + (i % 6);
    const citas = sesiones(inicio, cantidad, i, !cerrado);
    const ultima = citas[citas.length - 1].dias;
    await crearProceso(tx, {
      psicologaId,
      ninoId: null,
      referidoId: referido.id,
      expedienteId: expediente.id,
      citas,
      cierre: cerrado
        ? { dias: Math.min(-1, ultima + 3), motivo: elegir(MOTIVOS, i / 5) }
        : null,
      i,
    });

    const nino = expediente.ninos[0];
    if (nino) {
      await crearProceso(tx, {
        psicologaId,
        ninoId: nino.id,
        referidoId: referido.id,
        expedienteId: expediente.id,
        citas: sesiones(inicio + 3, 3, i + 1, true),
        cierre: null,
        i: i + 1,
      });
    }

    return numero;
  });
}

async function cuentas(
  rol: 'TRABAJO_SOCIAL' | 'PSICOLOGIA',
): Promise<string[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { rol, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: 2,
  });
  if (usuarios.length === 0) {
    throw new Error(
      `No hay ningún usuario activo de ${rol}: corre primero el seed de usuarios (prisma/seed.ts).`,
    );
  }
  return usuarios.map((usuario) => usuario.id);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Este seed es solo para desarrollo: no corre en producción.',
    );
  }

  const [trabajoSocialId] = await cuentas('TRABAJO_SOCIAL');
  const psicologas = await cuentas('PSICOLOGIA');

  for (let i = 1; i <= TOTAL_USUARIAS; i++) {
    const nombres = elegir(NOMBRES, i);
    const apellidos = `Ficticia ${elegir(APELLIDOS, i)} ${String(i).padStart(2, '0')}`;
    const existente = await prisma.usuaria.findFirst({
      where: { nombres, apellidos },
      select: { id: true },
    });
    if (existente) {
      console.log(`Ya existe, se omite: ${nombres} ${apellidos}`);
      continue;
    }
    const numero = await crearCaso(
      i,
      nombres,
      apellidos,
      trabajoSocialId,
      psicologas,
    );
    console.log(`Creada: ${nombres} ${apellidos} — expediente ${numero}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
