import { Test, TestingModule } from '@nestjs/testing';
import { FileProcesorService } from './file-procesor.service';

describe('FileProcesorService', () => {
  let service: FileProcesorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileProcesorService],
    }).compile();

    service = module.get<FileProcesorService>(FileProcesorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
