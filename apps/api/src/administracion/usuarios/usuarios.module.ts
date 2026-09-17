import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { USUARIOS_REPOSITORY } from './interfaces/usuarios-repository.interface';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { UsuariosRepository } from './repositories/usuarios.repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsuariosController],
  providers: [
    UsuariosService,
    { provide: USUARIOS_REPOSITORY, useClass: UsuariosRepository },
  ],
})
export class UsuariosModule {}
