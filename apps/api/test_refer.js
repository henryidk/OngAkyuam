const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const expedientes = await prisma.expediente.findMany();
  const exp = expedientes[0];
  
  if (exp) {
    console.log('Testing referir on', exp.id);
    const nuevasAreas = Array.from(new Set([...exp.areasAsignadas, 'MEDICA']));
    const updated = await prisma.expediente.update({
      where: { id: exp.id },
      data: { areasAsignadas: nuevasAreas }
    });
    console.log('Success!', updated.areasAsignadas);
  }
}
main().then(() => prisma.());
