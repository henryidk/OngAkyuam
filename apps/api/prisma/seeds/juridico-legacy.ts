/**
 * Datos FICTICIOS con la forma que tenía Jurídico antes del rediseño (columna `estado`
 * INICIADO/CERRADO, abandonos sin motivo de catálogo, documentos sin carpeta). Sirve para
 * comprobar que el backfill de `juridico_backfill` convierte bien cada caso.
 *
 * Solo corre contra una base desechable migrada hasta justo ANTES de
 * `juridico_expandir_estados`: usa SQL directo porque el cliente de Prisma actual ya no conoce
 * ese esquema. Se niega a correr si la base ya tiene el esquema nuevo o tiene usuarias.
 *
 * Uso: crear la base desechable, aplicarle las migraciones anteriores al rediseño, correr este
 * script con `DATABASE_URL` apuntando a ella, aplicar las migraciones de Jurídico y comparar
 * con el resultado esperado que se documenta junto a cada proceso.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SENTENCIAS: string[] = [
  // Cuenta de sistema sin acceso: el hash no corresponde a ninguna contraseña.
  `INSERT INTO "Usuario" ("id","nombreCompleto","username","passwordHash","rol","updatedAt") VALUES
     ('u-ts','Trabajadora Ficticia','ficticia_ts','!','TRABAJO_SOCIAL',now()),
     ('u-jur','Abogada Ficticia','ficticia_jur','!','JURIDICO',now())`,

  `INSERT INTO "Usuaria" ("id","nombres","apellidos","fechaNacimiento","grupoEtnico","updatedAt") VALUES
     ('ua-1','Usuaria','Ficticia Uno','1990-01-15',(enum_range(NULL::"GrupoEtnico"))[1],now()),
     ('ua-2','Usuaria','Ficticia Dos','1985-06-30',(enum_range(NULL::"GrupoEtnico"))[1],now())`,

  `INSERT INTO "Expediente" ("id","numero","usuariaId","fecha","tipoRegistro","creadoPorId","updatedAt") VALUES
     ('e-1','901-2026','ua-1','2026-03-01',(enum_range(NULL::"TipoRegistro"))[1],'u-ts',now()),
     ('e-2','902-2026','ua-2','2026-04-01',(enum_range(NULL::"TipoRegistro"))[1],'u-ts',now())`,

  // e-1 tiene procesos → su referido a Jurídico debe quedar atendido. e-2 no → sigue pendiente.
  `INSERT INTO "ReferidoArea" ("id","expedienteId","area","otorgadoPorId") VALUES
     ('r-1','e-1','JURIDICO','u-ts'),
     ('r-2','e-1','PSICOLOGIA','u-ts'),
     ('r-3','e-2','JURIDICO','u-ts')`,

  // p-1 abierto con nota y documento  → J1, EN_PROCESO / ACTIVO, última actuación = documento
  // p-2 cerrado                       → J2, FINALIZADO / ACTIVO, forma OTROS
  // p-3 abierto con abandono          → J3, EN_PROCESO / ABANDONADO
  // p-4 cerrado con abandono          → J4, FINALIZADO / ACTIVO (finalizado gana)
  `INSERT INTO "ProcesoJuridico" ("id","expedienteId","tipo","estado","fechaInicio","fechaCierre","creadoPorId","createdAt","updatedAt") VALUES
     ('p-1','e-1','GUARDA_CUSTODIA','INICIADO','2026-03-02',NULL,'u-jur','2026-03-02T15:00:00Z',now()),
     ('p-2','e-1','MEDIDAS_SEGURIDAD','CERRADO','2026-03-03','2026-05-10','u-jur','2026-03-03T15:00:00Z',now()),
     ('p-3','e-1','DIVORCIO_MUTUO_ACUERDO','INICIADO','2026-03-04',NULL,'u-jur','2026-03-04T15:00:00Z',now()),
     ('p-4','e-1','MENAJE_CASA','CERRADO','2026-03-05','2026-06-01','u-jur','2026-03-05T15:00:00Z',now())`,

  `INSERT INTO "NotaAvanceProceso" ("id","procesoId","contenido","registradoPorId","createdAt") VALUES
     ('n-1','p-1','Nota ficticia de seguimiento','u-jur','2026-04-10T16:00:00Z')`,

  `INSERT INTO "DocumentoProceso" ("id","procesoId","nombreVisible","nombreArchivo","claveR2","mimeType","tamanioBytes","subidoPorId","createdAt") VALUES
     ('d-1','p-1','Documento ficticio','ficticio.pdf','ficticio/d-1.pdf','application/pdf',1024,'u-jur','2026-05-20T16:00:00Z')`,

  `INSERT INTO "AbandonoProceso" ("id","procesoId","fecha","motivo","registradoPorId") VALUES
     ('a-1','p-3','2026-06-15','Dejó de presentarse (ficticio)','u-jur'),
     ('a-2','p-4','2026-05-01',NULL,'u-jur')`,
];

async function main(): Promise<void> {
  const [{ nuevo }] = await prisma.$queryRawUnsafe<{ nuevo: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns
       WHERE table_name = 'ProcesoJuridico' AND column_name = 'fase') AS nuevo`,
  );
  if (nuevo) {
    throw new Error(
      'Esta base ya tiene el esquema nuevo de Jurídico: el seed solo corre antes de juridico_expandir_estados.',
    );
  }
  const [{ total }] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT count(*) AS total FROM "Usuaria"`,
  );
  if (total > 0n) {
    throw new Error(
      'La base no está vacía: este seed solo corre en una base desechable.',
    );
  }

  await prisma.$transaction(
    SENTENCIAS.map((sentencia) => prisma.$executeRawUnsafe(sentencia)),
  );
  console.log('Seed ficticio de Jurídico (esquema anterior) cargado.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
