import { Test, TestingModule } from '@nestjs/testing';
import { ExpedientesController } from './expedientes.controller';

describe('ExpedientesController', () => {
  let controller: ExpedientesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpedientesController],
    }).compile();

    controller = module.get<ExpedientesController>(ExpedientesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
