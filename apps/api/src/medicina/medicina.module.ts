import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MedicinaController } from './medicina.controller';
import { MedicinaService } from './medicina.service';
@Module({
  imports: [PrismaModule],
  controllers: [MedicinaController],
  providers: [MedicinaService],
})
export class MedicinaModule {}
