/**
 * Usuarias FICTICIAS de Jurídico para desarrollo. Ningún dato corresponde a una persona real.
 *  - `USUARIAS`: referidas y todavía pendientes → prueban la bandeja y el registro de procesos.
 *  - `USUARIAS_CON_HISTORIAL`: ya atendidas, con procesos en cada estado → prueban la lista de
 *    procesos, el detalle y la búsqueda de expedientes (por nombre o DPI).
 *
 * Solo se corre a mano y nunca en producción (se niega si NODE_ENV es "production"). Es
 * idempotente: una usuaria que ya existe (mismos nombres y apellidos) se omite, así que
 * correrlo dos veces no duplica ni reinicia nada.
 *
 * Uso, desde apps/api:  npx ts-node prisma/seeds/usuarias-referidas-juridico.ts
 */
import {
  Prisma,
  PrismaClient,
  type FaseProcesoJuridico,
  type FormaFinalizacionProceso,
  type SituacionProcesoJuridico,
  type TipoEntradaBitacora,
  type GrupoEtnico,
  type MunicipioAltaVerapaz,
  type Rol,
  type TipologiaDelito,
  type TipoProcesoJuridico,
} from '@prisma/client';

const prisma = new PrismaClient();

interface UsuariaReferidaSeed {
  nombres: string;
  apellidos: string;
  /** Ficticio, 13 dígitos: toda usuaria mayor de edad lleva DPI. */
  dpi: string;
  fechaNacimiento: string;
  grupoEtnico: GrupoEtnico;
  municipio: MunicipioAltaVerapaz;
  fechaCaso: string;
  tipologia: TipologiaDelito[];
  motivo: string;
  procesosSugeridos: TipoProcesoJuridico[];
  tambienPsicologia?: boolean;
}

const USUARIAS: UsuariaReferidaSeed[] = [
  {
    nombres: 'Ana Lucía',
    apellidos: 'Ficticia Caal',
    dpi: '0000000051601',
    fechaNacimiento: '1991-04-12',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    fechaCaso: '2026-09-22',
    tipologia: ['FISICA', 'PSICOLOGICA'],
    motivo: 'Dato ficticio: solicita medidas de seguridad.',
    procesosSugeridos: ['MEDIDAS_SEGURIDAD'],
    tambienPsicologia: true,
  },
  {
    nombres: 'María Elena',
    apellidos: 'Ficticia Pop',
    dpi: '0000000061601',
    fechaNacimiento: '1987-11-03',
    grupoEtnico: 'MAYA_POQOMCHI',
    municipio: 'TACTIC',
    fechaCaso: '2026-09-23',
    tipologia: ['ECONOMICA_PATRIMONIAL'],
    motivo: 'Dato ficticio: pensión alimenticia para dos hijos.',
    procesosSugeridos: ['FIJACION_PENSION_ALIMENTICIA', 'GUARDA_CUSTODIA'],
  },
  {
    nombres: 'Rosa Amelia',
    apellidos: 'Ficticia Tiul',
    dpi: '0000000071601',
    fechaNacimiento: '1995-02-27',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'SAN_CRISTOBAL_VERAPAZ',
    fechaCaso: '2026-09-24',
    tipologia: ['PSICOLOGICA'],
    motivo: 'Dato ficticio: consulta sobre divorcio.',
    procesosSugeridos: ['DIVORCIO_MUTUO_ACUERDO'],
  },
  {
    nombres: 'Carmen Julia',
    apellidos: 'Ficticia Morales',
    dpi: '0000000081601',
    fechaNacimiento: '1982-08-19',
    grupoEtnico: 'LADINO',
    municipio: 'COBAN',
    fechaCaso: '2026-09-25',
    tipologia: ['FISICA', 'ECONOMICA_PATRIMONIAL'],
    motivo: 'Dato ficticio: medidas de seguridad y menaje de casa.',
    procesosSugeridos: ['MEDIDAS_SEGURIDAD', 'MENAJE_CASA'],
  },
  {
    nombres: 'Sandra Paola',
    apellidos: 'Ficticia Xol',
    dpi: '0000000091601',
    fechaNacimiento: '1999-06-05',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'SANTA_CRUZ_VERAPAZ',
    fechaCaso: '2026-09-26',
    tipologia: ['PSICOLOGICA'],
    motivo: 'Dato ficticio: reconocimiento de paternidad.',
    procesosSugeridos: ['PATERNIDAD_FILIACION'],
  },
  {
    // Sin procesos sugeridos: Jurídico decide qué abrir.
    nombres: 'Gloria Isabel',
    apellidos: 'Ficticia Coc',
    dpi: '0000000101601',
    fechaNacimiento: '1978-12-30',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'TAMAHU',
    fechaCaso: '2026-09-29',
    tipologia: ['ECONOMICA_PATRIMONIAL'],
    motivo: 'Dato ficticio: orientación legal general.',
    procesosSugeridos: [],
  },
];

async function crear(
  datos: UsuariaReferidaSeed,
  trabajoSocialId: string,
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

    const numero = await siguienteNumero(tx, datos.fechaCaso);

    const areas: Rol[] = datos.tambienPsicologia
      ? ['JURIDICO', 'PSICOLOGIA']
      : ['JURIDICO'];

    await tx.expediente.create({
      data: {
        numero,
        usuariaId: usuaria.id,
        fecha: new Date(datos.fechaCaso),
        tipoRegistro: 'EXTERNA',
        tipologiaDelito: datos.tipologia,
        creadoPorId: trabajoSocialId,
        referidos: {
          create: areas.map((area) => ({
            area,
            otorgadoPorId: trabajoSocialId,
            motivo: datos.motivo,
            procesosSugeridos:
              area === 'JURIDICO' ? datos.procesosSugeridos : [],
          })),
        },
      },
    });
    return numero;
  });
}

interface ProcesoSeed {
  tipo: TipoProcesoJuridico;
  fase: FaseProcesoJuridico;
  situacion: SituacionProcesoJuridico;
  fechaInicio: string;
  /** Instante de la última actuación; más de 60 días atrás dispara "Sin actuación hace N días". */
  ultimaActuacion: string;
  numeroJudicial?: string;
  organoJudicial?: string;
  contraparte?: string;
  /** Posición (desde 0) del proceso anterior de la misma usuaria con el que se vincula. */
  vinculadoCon?: number;
  cierre?: {
    fecha: string;
    forma: FormaFinalizacionProceso;
    detalle?: string;
  };
  bitacora: { tipo: TipoEntradaBitacora; contenido: string; en: string }[];
}

interface UsuariaConHistorialSeed {
  nombres: string;
  apellidos: string;
  dpi: string;
  telefono: string;
  fechaNacimiento: string;
  grupoEtnico: GrupoEtnico;
  municipio: MunicipioAltaVerapaz;
  fechaCaso: string;
  tipologia: TipologiaDelito[];
  procesos: ProcesoSeed[];
  /** La usuaria regresó: segundo expediente, referido y todavía pendiente en la bandeja. */
  regreso?: { fechaCaso: string; motivo: string };
}

// DPI y teléfonos con ceros a propósito: no corresponden a ningún documento ni número real.
const USUARIAS_CON_HISTORIAL: UsuariaConHistorialSeed[] = [
  {
    nombres: 'Juana Patricia',
    apellidos: 'Ficticia Choc',
    dpi: '0000000011601',
    telefono: '0000-0001',
    fechaNacimiento: '1989-03-08',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    fechaCaso: '2026-08-03',
    tipologia: ['FISICA', 'ECONOMICA_PATRIMONIAL'],
    procesos: [
      {
        tipo: 'FIJACION_PENSION_ALIMENTICIA',
        fase: 'EN_PROCESO',
        situacion: 'ACTIVO',
        fechaInicio: '2026-08-05',
        ultimaActuacion: '2026-09-24T16:00:00Z',
        numeroJudicial: '00000-2026-00101',
        organoJudicial: 'Juzgado ficticio de Familia',
        contraparte: 'Contraparte Ficticia Uno',
        bitacora: [
          {
            tipo: 'ESCRITO',
            contenido: 'Dato ficticio: se presentó la demanda.',
            en: '2026-08-12T15:00:00Z',
          },
          {
            tipo: 'AUDIENCIA',
            contenido: 'Dato ficticio: audiencia de conciliación sin acuerdo.',
            en: '2026-09-24T16:00:00Z',
          },
        ],
      },
      {
        tipo: 'GUARDA_CUSTODIA',
        fase: 'EN_PROCESO',
        situacion: 'ACTIVO',
        fechaInicio: '2026-09-20',
        ultimaActuacion: '2026-09-20T15:00:00Z',
        bitacora: [],
      },
    ],
  },
  {
    nombres: 'Marta Leticia',
    apellidos: 'Ficticia Ical',
    dpi: '0000000021601',
    telefono: '0000-0002',
    fechaNacimiento: '1984-07-21',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'TACTIC',
    fechaCaso: '2026-02-10',
    tipologia: ['ECONOMICA_PATRIMONIAL'],
    procesos: [
      {
        tipo: 'FIJACION_PENSION_ALIMENTICIA',
        fase: 'FINALIZADO',
        situacion: 'ACTIVO',
        fechaInicio: '2026-02-12',
        ultimaActuacion: '2026-05-15T16:00:00Z',
        numeroJudicial: '00000-2026-00102',
        organoJudicial: 'Juzgado ficticio de Familia',
        contraparte: 'Contraparte Ficticia Dos',
        cierre: { fecha: '2026-05-15', forma: 'SENTENCIA' },
        bitacora: [
          {
            tipo: 'RESOLUCION',
            contenido: 'Dato ficticio: sentencia que fija la pensión.',
            en: '2026-05-15T16:00:00Z',
          },
        ],
      },
      {
        // Ejecución de la pensión ya fijada; lleva meses sin actuación → requiere atención.
        tipo: 'EJECUCION_VIA_APREMIO',
        fase: 'EN_PROCESO',
        situacion: 'ACTIVO',
        fechaInicio: '2026-06-01',
        ultimaActuacion: '2026-06-18T16:00:00Z',
        numeroJudicial: '00000-2026-00103',
        organoJudicial: 'Juzgado ficticio de Familia',
        contraparte: 'Contraparte Ficticia Dos',
        vinculadoCon: 0,
        bitacora: [
          {
            tipo: 'ESCRITO',
            contenido: 'Dato ficticio: solicitud de ejecución presentada.',
            en: '2026-06-18T16:00:00Z',
          },
        ],
      },
    ],
    regreso: {
      fechaCaso: '2026-09-28',
      motivo: 'Dato ficticio: regresa por modificación de la pensión.',
    },
  },
  {
    nombres: 'Elvira Noemí',
    apellidos: 'Ficticia Bol',
    dpi: '0000000031601',
    telefono: '0000-0003',
    fechaNacimiento: '1993-10-14',
    grupoEtnico: 'MAYA_POQOMCHI',
    municipio: 'SAN_CRISTOBAL_VERAPAZ',
    fechaCaso: '2026-05-04',
    tipologia: ['PSICOLOGICA'],
    procesos: [
      {
        tipo: 'DIVORCIO_CAUSAL_DETERMINADA',
        fase: 'EN_PROCESO',
        situacion: 'SUSPENDIDO',
        fechaInicio: '2026-05-06',
        ultimaActuacion: '2026-09-10T16:00:00Z',
        numeroJudicial: '00000-2026-00104',
        organoJudicial: 'Juzgado ficticio de Familia',
        contraparte: 'Contraparte Ficticia Tres',
        bitacora: [
          {
            tipo: 'NOTIFICACION',
            contenido: 'Dato ficticio: no se logró notificar a la contraparte.',
            en: '2026-08-20T16:00:00Z',
          },
        ],
      },
      {
        tipo: 'MENAJE_CASA',
        fase: 'FINALIZADO',
        situacion: 'ACTIVO',
        fechaInicio: '2026-05-06',
        ultimaActuacion: '2026-07-02T16:00:00Z',
        cierre: { fecha: '2026-07-02', forma: 'CONVENIO' },
        bitacora: [
          {
            tipo: 'DILIGENCIA',
            contenido: 'Dato ficticio: entrega de bienes según convenio.',
            en: '2026-07-02T16:00:00Z',
          },
        ],
      },
    ],
  },
  {
    nombres: 'Dora Angélica',
    apellidos: 'Ficticia Maquín',
    dpi: '0000000041601',
    telefono: '0000-0004',
    fechaNacimiento: '1980-01-29',
    grupoEtnico: 'LADINO',
    municipio: 'COBAN',
    fechaCaso: '2026-04-13',
    tipologia: ['FISICA'],
    procesos: [
      {
        tipo: 'MEDIDAS_SEGURIDAD',
        fase: 'EN_PROCESO',
        situacion: 'ABANDONADO',
        fechaInicio: '2026-04-15',
        ultimaActuacion: '2026-08-05T16:00:00Z',
        bitacora: [
          {
            tipo: 'CONTACTO_USUARIA',
            contenido: 'Dato ficticio: no contestó las llamadas.',
            en: '2026-07-20T16:00:00Z',
          },
        ],
      },
      {
        tipo: 'DIVORCIO_MUTUO_ACUERDO',
        fase: 'FINALIZADO',
        situacion: 'ACTIVO',
        fechaInicio: '2026-04-15',
        ultimaActuacion: '2026-06-09T16:00:00Z',
        cierre: { fecha: '2026-06-09', forma: 'DESISTIMIENTO' },
        bitacora: [],
      },
      {
        tipo: 'RELACIONES_FAMILIARES',
        fase: 'FINALIZADO',
        situacion: 'ACTIVO',
        fechaInicio: '2026-04-20',
        ultimaActuacion: '2026-06-30T16:00:00Z',
        cierre: {
          fecha: '2026-06-30',
          forma: 'OTROS',
          detalle: 'Dato ficticio: archivado por el juzgado.',
        },
        bitacora: [],
      },
    ],
  },
];

interface ContextoSeed {
  trabajoSocialId: string;
  juridicoId: string;
  abogadaId: string;
  procuradoraId: string;
}

/** Misma numeración que usa el sistema, para no chocar con expedientes creados después. */
async function siguienteNumero(
  tx: Prisma.TransactionClient,
  fechaCaso: string,
): Promise<string> {
  const anio = Number(fechaCaso.slice(0, 4));
  const contador = await tx.expedienteContador.upsert({
    where: { anio },
    create: { anio, ultimo: 1 },
    update: { ultimo: { increment: 1 } },
  });
  return `${String(contador.ultimo).padStart(2, '0')}-${anio}`;
}

async function crearConHistorial(
  datos: UsuariaConHistorialSeed,
  ctx: ContextoSeed,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const usuaria = await tx.usuaria.create({
      data: {
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        dpi: datos.dpi,
        telefono: datos.telefono,
        fechaNacimiento: new Date(datos.fechaNacimiento),
        grupoEtnico: datos.grupoEtnico,
        municipio: datos.municipio,
      },
    });

    const numero = await siguienteNumero(tx, datos.fechaCaso);
    const expediente = await tx.expediente.create({
      data: {
        numero,
        usuariaId: usuaria.id,
        fecha: new Date(datos.fechaCaso),
        tipoRegistro: 'EXTERNA',
        tipologiaDelito: datos.tipologia,
        creadoPorId: ctx.trabajoSocialId,
      },
    });
    const referido = await tx.referidoArea.create({
      data: {
        expedienteId: expediente.id,
        area: 'JURIDICO',
        otorgadoPorId: ctx.trabajoSocialId,
        motivo: 'Dato ficticio: referida para atención legal.',
        procesosSugeridos: [datos.procesos[0].tipo],
        createdAt: new Date(`${datos.fechaCaso}T15:00:00Z`),
        atendidoEn: new Date(`${datos.procesos[0].fechaInicio}T15:00:00Z`),
      },
    });

    const idsCreados: string[] = [];
    for (const [indice, proceso] of datos.procesos.entries()) {
      const registradoEn = new Date(`${proceso.fechaInicio}T15:00:00Z`);
      const creado = await tx.procesoJuridico.create({
        data: {
          expedienteId: expediente.id,
          referidoId: referido.id,
          tipo: proceso.tipo,
          consecutivo: indice + 1,
          fase: proceso.fase,
          situacion: proceso.situacion,
          formaFinalizacion: proceso.cierre?.forma,
          detalleFinalizacion: proceso.cierre?.detalle,
          fechaCierre: proceso.cierre ? new Date(proceso.cierre.fecha) : null,
          numeroJudicial: proceso.numeroJudicial,
          organoJudicial: proceso.organoJudicial,
          contraparte: proceso.contraparte,
          procesoOrigenId:
            proceso.vinculadoCon === undefined
              ? null
              : idsCreados[proceso.vinculadoCon],
          abogadaId: ctx.abogadaId,
          procuradoraId: ctx.procuradoraId,
          fechaInicio: new Date(proceso.fechaInicio),
          ultimaActuacionEn: new Date(proceso.ultimaActuacion),
          creadoPorId: ctx.juridicoId,
          createdAt: registradoEn,
        },
      });
      idsCreados.push(creado.id);

      const entradas: Prisma.NotaAvanceProcesoCreateManyInput[] = [
        {
          procesoId: creado.id,
          tipo: 'SISTEMA',
          contenido: 'Proceso iniciado desde referencia de Trabajo Social',
          registradoPorId: ctx.juridicoId,
          createdAt: registradoEn,
        },
        ...proceso.bitacora.map((entrada) => ({
          procesoId: creado.id,
          tipo: entrada.tipo,
          contenido: entrada.contenido,
          registradoPorId: ctx.juridicoId,
          createdAt: new Date(entrada.en),
        })),
      ];
      const ultima = new Date(proceso.ultimaActuacion);
      if (proceso.cierre) {
        entradas.push({
          procesoId: creado.id,
          tipo: 'SISTEMA',
          contenido: 'Proceso finalizado',
          registradoPorId: ctx.juridicoId,
          createdAt: ultima,
        });
      }
      if (proceso.situacion === 'SUSPENDIDO') {
        await tx.suspensionProceso.create({
          data: {
            procesoId: creado.id,
            motivo: 'Dato ficticio: en espera de notificar a la contraparte.',
            desde: ultima,
            registradoPorId: ctx.juridicoId,
          },
        });
        entradas.push({
          procesoId: creado.id,
          tipo: 'SISTEMA',
          contenido: 'Proceso suspendido',
          registradoPorId: ctx.juridicoId,
          createdAt: ultima,
        });
      }
      if (proceso.situacion === 'ABANDONADO') {
        await tx.abandonoProceso.create({
          data: {
            procesoId: creado.id,
            fecha: new Date(proceso.ultimaActuacion.slice(0, 10)),
            motivoCatalogo: 'NO_RESPONDE',
            motivo: 'Dato ficticio: dejó de presentarse a las citas.',
            ultimoContacto: new Date('2026-07-01'),
            intentosContacto: 3,
            notificadoATs: true,
            registradoPorId: ctx.juridicoId,
            createdAt: ultima,
          },
        });
        entradas.push({
          procesoId: creado.id,
          tipo: 'SISTEMA',
          contenido: 'Abandono registrado',
          registradoPorId: ctx.juridicoId,
          createdAt: ultima,
        });
      }
      await tx.notaAvanceProceso.createMany({ data: entradas });
    }

    if (datos.regreso) {
      await tx.expediente.create({
        data: {
          numero: await siguienteNumero(tx, datos.regreso.fechaCaso),
          usuariaId: usuaria.id,
          fecha: new Date(datos.regreso.fechaCaso),
          tipoRegistro: 'EXTERNA',
          tipologiaDelito: datos.tipologia,
          creadoPorId: ctx.trabajoSocialId,
          referidos: {
            create: {
              area: 'JURIDICO',
              otorgadoPorId: ctx.trabajoSocialId,
              motivo: datos.regreso.motivo,
              procesosSugeridos: ['MODIFICACION_PENSION_ALIMENTICIA'],
            },
          },
        },
      });
    }
    return numero;
  });
}

/** Usa el personal de Jurídico que ya exista; si falta un cargo, crea uno ficticio. */
async function personalJuridico(tipo: string, nombre: string): Promise<string> {
  const existente = await prisma.personal.findFirst({
    where: { area: 'JURIDICO', tipo, activo: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (existente) {
    return existente.id;
  }
  const creado = await prisma.personal.create({
    data: { area: 'JURIDICO', tipo, nombre },
    select: { id: true },
  });
  return creado.id;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Este seed es solo para desarrollo: no corre en producción.',
    );
  }

  const trabajoSocial = await prisma.usuario.findFirst({
    where: { rol: 'TRABAJO_SOCIAL' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!trabajoSocial) {
    throw new Error(
      'No hay ningún usuario de Trabajo Social: corre primero el seed de usuarios (prisma/seed.ts).',
    );
  }

  for (const datos of USUARIAS) {
    const nombre = `${datos.nombres} ${datos.apellidos}`;
    const existente = await prisma.usuaria.findFirst({
      where: { nombres: datos.nombres, apellidos: datos.apellidos },
      select: { id: true },
    });
    if (existente) {
      console.log(`Ya existe, se omite: ${nombre}`);
      continue;
    }
    const numero = await crear(datos, trabajoSocial.id);
    console.log(`Creada: ${nombre} — expediente ${numero}`);
  }

  const juridico = await prisma.usuario.findFirst({
    where: { rol: 'JURIDICO' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!juridico) {
    throw new Error(
      'No hay ningún usuario de Jurídico: corre primero el seed de usuarios (prisma/seed.ts).',
    );
  }
  const ctx: ContextoSeed = {
    trabajoSocialId: trabajoSocial.id,
    juridicoId: juridico.id,
    abogadaId: await personalJuridico('ABOGADA', 'Abogada Ficticia'),
    procuradoraId: await personalJuridico(
      'PROCURADORA',
      'Procuradora Ficticia',
    ),
  };

  for (const datos of USUARIAS_CON_HISTORIAL) {
    const nombre = `${datos.nombres} ${datos.apellidos}`;
    const existente = await prisma.usuaria.findFirst({
      where: { nombres: datos.nombres, apellidos: datos.apellidos },
      select: { id: true },
    });
    if (existente) {
      console.log(`Ya existe, se omite: ${nombre}`);
      continue;
    }
    const numero = await crearConHistorial(datos, ctx);
    console.log(
      `Creada: ${nombre} — expediente ${numero}, ${datos.procesos.length} procesos`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
