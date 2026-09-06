const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const expedientes = await prisma.expediente.findMany({
    select: { id: true, codigoCaso: true, areasAsignadas: true }
  });
  console.log(JSON.stringify(expedientes, null, 2));
}
check().then(() => prisma.());
