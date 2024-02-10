import { Test, TestingModule } from '@nestjs/testing';
import { ScotiaService } from './scotia.service';

describe('ScotiaService', () => {
  let service: ScotiaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScotiaService],
    }).compile();

    service = module.get<ScotiaService>(ScotiaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
