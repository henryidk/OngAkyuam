import { Test, TestingModule } from '@nestjs/testing';
import { ExpedientesService } from './expedientes.service';

describe('ExpedientesService', () => {
  let service: ExpedientesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpedientesService],
    }).compile();

    service = module.get<ExpedientesService>(ExpedientesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
