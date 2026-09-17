import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PERSONAL_REPOSITORY } from './interfaces/personal-repository.interface';
import { PersonalController } from './personal.controller';
import { PersonalService } from './personal.service';
import { PersonalRepository } from './repositories/personal.repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PersonalController],
  providers: [
    PersonalService,
    { provide: PERSONAL_REPOSITORY, useClass: PersonalRepository },
  ],
  // Otras áreas (ej. jurídico) validan sus asignaciones contra `Personal` directamente.
  exports: [PERSONAL_REPOSITORY],
})
export class PersonalModule {}
