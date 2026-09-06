import { Test, TestingModule } from '@nestjs/testing';
import { ExpedientesController } from './expedientes.controller';
import { ExpedientesService } from './expedientes.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ExpedientesController', () => {
  let controller: ExpedientesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpedientesController],
      providers: [
        ExpedientesService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ExpedientesController>(ExpedientesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
