import { Body, Controller, Get, Post } from '@nestjs/common';
import { ScotiaService } from './scotia.service';
import { ExcelProcessorService } from 'src/excel-processor/excel-processor.service';
import { CsvExtractDto } from 'src/dto/scotia.dto';
import { getFormattedDate, isValidDateFormat } from 'src/utils/utils';
import { GoogleDriveService } from 'src/google-drive/google-drive.service';

import spreadData from '../config/spreadsheet.json';

@Controller('scotia')
export class ScotiaController {

  environment: string;

  constructor (
    private scotiaService: ScotiaService,
    private googleDriveService: GoogleDriveService,
  ) {}

  @Post('v1/extract')
  async getCsvData(@Body() body: CsvExtractDto) {

    const date = getFormattedDate(body.extractDate);
    console.log(date)
    if (date.getFullYear() < 2024) {
      return {message: "Only can extract data since year greater or equal 2024"}
    }

    const envs = ["dev", "prod"];
    if (!envs.includes(body.environment)) {
      return "No environment"
    }
    
    this.googleDriveService.spreadsheetId =
    this.environment === 'dev'
      ? spreadData.devSpread
      : spreadData.prodSpread;

    const result = await this.scotiaService.extractCsvData(body.extractDate);

    return result
  }

  @Post('v2/extract')
  async getCsvDatav2(@Body() body: CsvExtractDto) {

    if (!isValidDateFormat(body.extractDate)) {
      return { message: `Date format will be DD/MM/YYYY, ${body.extractDate} is not valid`}
    }

    if (getFormattedDate(body.extractDate).getFullYear() < 2024) {
      return {message: "Only can extract data since year greater or equal 2024"}
    }

    const envs = ["dev", "prod"];
    if (!envs.includes(body.environment)) {
      return {message: `Environment <${body.environment}> doesn't exists`}
    }
    
    this.googleDriveService.spreadsheetId =
    this.environment === 'dev'
      ? spreadData.devSpread
      : spreadData.prodSpread;

    const result = await this.scotiaService.extractCsvDataV2(body.extractDate);

    return result
  }
}
