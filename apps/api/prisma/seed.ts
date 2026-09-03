import { PrismaClient, type Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { BCRYPT_ROUNDS } from '../src/auth/constants/auth.constants';

const prisma = new PrismaClient();

interface UsuarioSeed {
  username: string;
  nombreCompleto: string;
  rol: Rol;
}

const USUARIOS_SEED: UsuarioSeed[] = [
  {
    username: 'administracion',
    nombreCompleto: 'Usuario Administración',
    rol: 'ADMINISTRACION',
  },
  {
    username: 'trabajo_social',
    nombreCompleto: 'Usuario Trabajo Social',
    rol: 'TRABAJO_SOCIAL',
  },
  { username: 'juridico', nombreCompleto: 'Usuario Jurídico', rol: 'JURIDICO' },
  {
    username: 'psicologia',
    nombreCompleto: 'Usuario Psicología',
    rol: 'PSICOLOGIA',
  },
  { username: 'medica', nombreCompleto: 'Usuario Médica', rol: 'MEDICA' },
];

function generarPasswordTemporal(): string {
  return randomBytes(12).toString('base64url');
}

async function main(): Promise<void> {
  const credencialesGeneradas: { username: string; password: string }[] = [];

  for (const usuarioSeed of USUARIOS_SEED) {
    const existente = await prisma.usuario.findUnique({
      where: { username: usuarioSeed.username },
    });

    if (existente) {
      console.log(`Ya existe, se omite: ${usuarioSeed.username}`);
      continue;
    }

    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, BCRYPT_ROUNDS);

    await prisma.usuario.create({
      data: {
        username: usuarioSeed.username,
        nombreCompleto: usuarioSeed.nombreCompleto,
        rol: usuarioSeed.rol,
        passwordHash,
        mustChangePassword: true,
      },
    });

    credencialesGeneradas.push({
      username: usuarioSeed.username,
      password: passwordTemporal,
    });
  }

  if (credencialesGeneradas.length === 0) {
    console.log('No se crearon usuarios nuevos.');
    return;
  }

  console.log(
    '\nUsuarios creados — copiar estas contraseñas ahora, no se muestran de nuevo:\n',
  );
  for (const { username, password } of credencialesGeneradas) {
    console.log(`  ${username.padEnd(16)} ${password}`);
  }
  console.log('\nTodos deben cambiar su contraseña en el primer login.\n');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
