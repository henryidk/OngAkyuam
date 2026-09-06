import { Test, TestingModule } from '@nestjs/testing';
import { ExpedientesController } from './expedientes.controller';
import { ExpedientesService } from './expedientes.service';
import { ExpedientesGateway } from './expedientes.gateway';
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
        {
          provide: ExpedientesGateway,
          useValue: {
            emitNewReference: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ExpedientesController>(ExpedientesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
