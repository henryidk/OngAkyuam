const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetPasswords() {
  const hash = await bcrypt.hash('123456', 10);
  await prisma.usuario.updateMany({
    data: { 
      passwordHash: hash,
      mustChangePassword: false 
    }
  });
  console.log('Contraseñas de todos los usuarios actualizadas a: 123456');
}

resetPasswords().then(() => prisma.());
