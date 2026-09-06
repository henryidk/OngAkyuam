import { Test, TestingModule } from '@nestjs/testing';
import { ExpedientesService } from './expedientes.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ExpedientesService', () => {
  let service: ExpedientesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpedientesService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ExpedientesService>(ExpedientesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
