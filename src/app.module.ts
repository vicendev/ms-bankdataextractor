import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScotiaController } from './scotia/scotia.controller';
import { ScotiaService } from './scotia/scotia.service';
import { FileProcesorService } from './file-procesor/file-procesor.service';
import { GoogleDriveService } from './google-drive/google-drive.service';
import { HttpModule } from '@nestjs/axios';
import { ExcelProcessorService } from './excel-processor/excel-processor.service';
import { GlobalVariableService } from './global-variable/global-variable.service';


@Module({
  imports: [HttpModule],
  controllers: [AppController, ScotiaController],
  providers: [AppService, ScotiaService, FileProcesorService, GoogleDriveService, ExcelProcessorService, GlobalVariableService],
})
export class AppModule {}
