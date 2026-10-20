/**
 * Audiencias FICTICIAS de Jurídico para desarrollo (planaudiencias.md §6.3). Se cuelgan de los
 * procesos abiertos de las usuarias ficticias que crea `usuarias-referidas-juridico.ts`, así
 * que ese seed se corre antes. Ningún dato corresponde a una persona real: las descripciones y
 * observaciones dicen "Dato ficticio".
 *
 * Deja un caso de cada estado de la sección Audiencias, con fechas relativas al día en que se
 * corre (siempre en día hábil):
 *  - próximas (en unos días) y una de hoy a las 16:00 (si se corre después de esa hora ya se
 *    ve como "Pendiente de resultado", que es justo lo que haría el reloj real);
 *  - pendiente de resultado (ayer, sin registrar);
 *  - realizada con observaciones, no realizada con motivo y cancelada a mano;
 *  - una cadena de reprogramación: la original REPROGRAMADA y la nueva fecha PROGRAMADA.
 *
 * Solo se corre a mano y nunca en producción (se niega si NODE_ENV es "production"). Es
 * idempotente: si cualquier proceso de una usuaria ficticia ya tiene audiencias, no hace nada,
 * así que correrlo dos veces no duplica ni reinicia nada. No borra ni modifica filas existentes.
 *
 * Uso, desde apps/api:  npx ts-node prisma/seeds/audiencias-juridico.ts
 */
import {
  PrismaClient,
  type EstadoAudiencia,
  type OrigenCancelacionAudiencia,
  type Prisma,
} from '@prisma/client';
import { diaSemanaGT, hoyGT, parseLocalGT, sumarDiasGT } from '@akyuam/shared';

const prisma = new PrismaClient();

/** Día ISO: 1 = lunes … 5 = viernes. Los juzgados no citan en fin de semana. */
const DIAS_HABILES: readonly number[] = [1, 2, 3, 4, 5];
const PREFIJO_FICTICIA = 'Ficticia';

/** El día hábil a `dias` días hábiles de hoy (0 = hoy si es hábil; si no, el siguiente). */
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

/** Instante UTC de una fecha y hora de Guatemala, en minuto exacto (lo exige un CHECK). */
function instante(fecha: string, hora: string): Date {
  return parseLocalGT(`${fecha}T${hora}`);
}

interface AudienciaSeed {
  /** Días hábiles desde hoy. */
  dias: number;
  hora: string;
  descripcion: string;
  estado: EstadoAudiencia;
  motivo?: string;
  observaciones?: string;
  origenCancelacion?: OrigenCancelacionAudiencia;
  /** La nueva fecha de una REPROGRAMADA: se crea enlazada a ella. */
  nuevaFecha?: { dias: number; hora: string };
}

/**
 * Un escenario por proceso. Cada uno usa horas distintas para no chocar con el índice de una
 * sola audiencia PROGRAMADA por responsable e instante, aunque compartan abogada.
 */
const ESCENARIOS: AudienciaSeed[][] = [
  [
    {
      dias: -15,
      hora: '09:00',
      descripcion: 'Primera audiencia',
      estado: 'REALIZADA',
      observaciones: 'Dato ficticio: se presentaron ambas partes.',
    },
    {
      dias: 3,
      hora: '09:00',
      descripcion: 'Conciliación',
      estado: 'PROGRAMADA',
    },
  ],
  [
    {
      dias: 0,
      hora: '16:00',
      descripcion: 'Recepción de pruebas',
      estado: 'PROGRAMADA',
    },
  ],
  [
    {
      dias: -1,
      hora: '10:30',
      descripcion: 'Conciliación',
      estado: 'PROGRAMADA',
    },
  ],
  [
    {
      dias: -4,
      hora: '11:00',
      descripcion: 'Junta conciliatoria',
      estado: 'REPROGRAMADA',
      motivo: 'Dato ficticio: el juzgado cambió la fecha.',
      nuevaFecha: { dias: 6, hora: '11:00' },
    },
  ],
  [
    {
      dias: -8,
      hora: '14:00',
      descripcion: 'Audiencia de prueba',
      estado: 'NO_REALIZADA',
      motivo: 'Dato ficticio: no se presentó la parte demandada.',
    },
    {
      dias: -2,
      hora: '14:00',
      descripcion: 'Audiencia de prueba',
      estado: 'CANCELADA',
      origenCancelacion: 'MANUAL',
      motivo: 'Dato ficticio: el juzgado suspendió el despacho.',
    },
  ],
];

interface ContextoSeed {
  juridicoId: string;
  abogadaPorDefectoId: string;
  ahora: Date;
}

async function crearEscenario(
  tx: Prisma.TransactionClient,
  proceso: { id: string; abogadaId: string | null },
  audiencias: AudienciaSeed[],
  ctx: ContextoSeed,
): Promise<void> {
  const responsableId = proceso.abogadaId ?? ctx.abogadaPorDefectoId;
  for (const datos of audiencias) {
    const conResultado =
      datos.estado === 'REALIZADA' || datos.estado === 'NO_REALIZADA';
    const creada = await tx.audienciaJuridica.create({
      data: {
        procesoId: proceso.id,
        inicio: instante(diaHabil(datos.dias), datos.hora),
        responsableId,
        estado: datos.estado,
        descripcion: datos.descripcion,
        observaciones: datos.observaciones ?? null,
        motivo: datos.motivo ?? null,
        origenCancelacion: datos.origenCancelacion ?? null,
        resultadoEn: conResultado ? ctx.ahora : null,
        creadoPorId: ctx.juridicoId,
      },
      select: { id: true },
    });
    if (datos.nuevaFecha) {
      await tx.audienciaJuridica.create({
        data: {
          procesoId: proceso.id,
          inicio: instante(
            diaHabil(datos.nuevaFecha.dias),
            datos.nuevaFecha.hora,
          ),
          responsableId,
          descripcion: datos.descripcion,
          reprogramadaDesdeId: creada.id,
          creadoPorId: ctx.juridicoId,
        },
      });
    }
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Este seed es solo para desarrollo: no corre en producción.',
    );
  }

  const deUsuariaFicticia: Prisma.ProcesoJuridicoWhereInput = {
    expediente: { usuaria: { apellidos: { startsWith: PREFIJO_FICTICIA } } },
  };
  const yaSembradas = await prisma.audienciaJuridica.count({
    where: { proceso: deUsuariaFicticia },
  });
  if (yaSembradas > 0) {
    console.log(
      `Ya hay ${yaSembradas} audiencias en procesos ficticios: no se agrega nada.`,
    );
    return;
  }

  const juridico = await prisma.usuario.findFirst({
    where: { rol: 'JURIDICO' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const abogada = await prisma.personal.findFirst({
    where: { area: 'JURIDICO', tipo: 'ABOGADA', activo: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!juridico || !abogada) {
    throw new Error(
      'Falta el usuario o la abogada de Jurídico: corre primero prisma/seed.ts y prisma/seeds/usuarias-referidas-juridico.ts.',
    );
  }

  // Solo procesos abiertos y activos: son los únicos donde se agenda (§2).
  const procesos = await prisma.procesoJuridico.findMany({
    where: {
      ...deUsuariaFicticia,
      fase: { not: 'FINALIZADO' },
      situacion: 'ACTIVO',
    },
    select: { id: true, abogadaId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: ESCENARIOS.length,
  });
  if (procesos.length === 0) {
    throw new Error(
      'No hay procesos abiertos de usuarias ficticias: corre primero prisma/seeds/usuarias-referidas-juridico.ts.',
    );
  }

  const ctx: ContextoSeed = {
    juridicoId: juridico.id,
    abogadaPorDefectoId: abogada.id,
    ahora: new Date(),
  };
  // Todo o nada: si una audiencia choca, no queda el seed a medias.
  await prisma.$transaction(async (tx) => {
    for (const [indice, proceso] of procesos.entries()) {
      await crearEscenario(tx, proceso, ESCENARIOS[indice], ctx);
    }
  });
  console.log(`Audiencias ficticias creadas en ${procesos.length} procesos.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
