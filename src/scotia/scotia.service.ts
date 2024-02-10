import { Injectable } from '@nestjs/common';
import { createReadStream } from 'fs';

import csv from 'csv-parser';
import { FileProcesorService } from 'src/file-procesor/file-procesor.service';
import { ScotiaDataBank } from 'src/interface/scotia.extractor.interface';
import { GoogleDriveService } from 'src/google-drive/google-drive.service';
import { FileGoogleDrive } from 'src/interface/file.google.interface';
import { ExcelProcessorService } from 'src/excel-processor/excel-processor.service';
import { GlobalVariableService } from 'src/global-variable/global-variable.service';
import { BankValuesGlobal } from 'src/interface/global-variable.interface';
import { formatDateString, getFormattedDate } from 'src/utils/utils';
import {
  DATE_FORMAT_BACKSLASH_DD_MM_YYYY,
  DATE_FORMAT_DDMMYYYY,
} from 'src/constants/date-format.constant';

@Injectable()
export class ScotiaService {
  private fileName: string = '';
  private adminSheet!: FileGoogleDrive;
  bankValues: BankValuesGlobal;

  environment: string;

  constructor(
    private fileProcessorService: FileProcesorService,
    private googleDriveService: GoogleDriveService,
    private excelProcessorService: ExcelProcessorService,
    private globalVariableService: GlobalVariableService,
  ) {
    this.bankValues = this.globalVariableService.getBankValues();
  }

  private bankDataList: Array<ScotiaDataBank> = new Array();

  /**
   * Extracts data from a CSV file, purges the extracted data based on a given date,
   * reads an Excel file, finds the index of the last registry in the bank data array
   * that matches certain conditions, writes the extracted data to the Excel file,
   * and uploads the updated Excel file to Google Drive.
   *
   * @param extractDate - The date to extract data from the CSV file.
   * @returns If there is no data to extract, the method returns an object with a `message` property indicating no data to extract.
   *          If there is no spreadsheet file to read, the method returns an object with a `message` property indicating no spreadsheet file to read.
   *          If there is no sheet to read, the method returns an object with a `message` property indicating no sheet to read.
   *          If the method is successful, it updates the Google Spreadsheet and returns nothing.
   */
  async extractCsvDataV2(
    extractDate: string,
  ): Promise<void | { message: string, stack: string }> {
    try {
      this.bankDataList = [];
      this.bankValues.extractDate = extractDate;
      this.globalVariableService.setBankValues(this.bankValues);

      this.fileName = await this.fileProcessorService.processFile();

      const stream = createReadStream(`./src/data/${this.fileName}`);

      await this.fileProcessorService.transformCsvData(
        stream,
        this.bankDataList,
      );

      await this.purgeListToDateExtract(this.bankDataList);

      const auth = await this.googleDriveService.authorize();

      const spreadSheet =
        await this.googleDriveService.getGoogleSpreadSheet(auth);

      const sheetTitle =
        await this.excelProcessorService.getSheetTitle(spreadSheet);

      let sheetValues =
        await this.googleDriveService.getGoogleSpreadSheetValues(
          auth,
          sheetTitle,
        );
      if (!sheetValues) sheetValues = [[]];

      await this.excelProcessorService.readSpreadsheetValues(sheetValues);

      const lastIndex = await this.findLastRegistry(this.bankDataList);

      let bankDataListToWrite = this.bankDataList;

      if (lastIndex) {
        bankDataListToWrite = this.bankDataList.slice(lastIndex + 1);
      }

      const updateSheetValues =
        await this.excelProcessorService.writeSpreadsheetValues(
          sheetValues,
          bankDataListToWrite,
        );

      await this.googleDriveService.updateGoogleSpreadSheetValues(
        auth,
        sheetTitle,
        updateSheetValues,
      );
    } catch (err) {
      if (err instanceof Error) {
        return { message: err.message, stack: err.stack };
      }

      return err;
    }
  }

  /**
   * Extracts data from a CSV file, purges the extracted data based on a given date, reads an Excel file,
   * finds the index of the last registry in the bank data array that matches certain conditions,
   * writes the extracted data to the Excel file, and uploads the updated Excel file to Google Drive.
   *
   * @param extractDate - The date to extract data from the CSV file.
   * @returns A promise that resolves to an object with the status, status text, and data of the upload result,
   *          or an object with a message indicating no data to extract.
   */
  async extractCsvData(
    extractDate: string,
  ): Promise<
    { status: number; statusText: string; data: any } | { message: string }
  > {
    this.bankDataList = [];
    this.bankValues.extractDate = extractDate;
    this.globalVariableService.setBankValues(this.bankValues);

    this.fileName = await this.fileProcessorService.processFile();

    const stream = createReadStream(`./src/data/${this.fileName}`);

    await new Promise<void>((resolve) => {
      stream
        .pipe(csv({ separator: ';' }))
        .on('data', (data) => this.bankDataList.push(data))
        .on('end', () => {
          resolve();
        });
    });

    await this.purgeListToDateExtract(this.bankDataList);

    const auth = await this.googleDriveService.authorize();
    const files = await this.googleDriveService.getFilesFromFolder(auth);

    for (const file of files) {
      if (file.name.includes('Adm Mensual_test')) {
        this.adminSheet = file as FileGoogleDrive;
        break;
      }
    }
    const filePath = await this.googleDriveService.downloadFileById(
      auth,
      this.adminSheet.id,
    );

    await this.excelProcessorService.readExcel(filePath);

    const lastIndex = await this.findLastRegistry(this.bankDataList);

    const bankDataListToWrite = this.bankDataList.slice(lastIndex + 1);
    await this.excelProcessorService.writeExcel(filePath, bankDataListToWrite);

    const result = await this.googleDriveService.uploadFile(
      auth,
      this.adminSheet.name,
    );
    return {
      status: result.status,
      statusText: result.statusText,
      data: result.data,
    };
  }

  /**
   * Search for the index of the last registry in the bank data array that matches certain conditions.
   *
   * @param bankData - An array of objects representing bank data, where each object has properties 'fecha', 'cargos', and 'abonos'.
   * @returns The index of the last registry in the bank data array that matches the given conditions.
   */
  private async findLastRegistry(
    bankData: Array<ScotiaDataBank>,
  ): Promise<number> {
    const { excelDate, excelExpenditure, excelIncome } = this.bankValues;
    let lastIndex = 0;
    bankData.forEach((item, index) => {
      const formatDate = formatDateString(item.fecha, DATE_FORMAT_DDMMYYYY);
      const bankExpenditure = parseFloat(
        item.cargos.replace(/^0+/, '').replace(',', '.'),
      );
      const bankIncome = parseFloat(
        item.abonos.replace(/^0+/, '').replace(',', '.'),
      );

      let hasSameValues =
        excelDate == formatDate &&
        (excelExpenditure == bankExpenditure || excelIncome == bankIncome);
      if (hasSameValues) {
        lastIndex = index;
      }
    });

    return lastIndex;
  }

  /**
 * Extracts data from a CSV file, purges the extracted data based on a given date,
 * reads an Excel file, finds the index of the last registry in the bank data array
 * that matches certain conditions, writes the extracted data to the Excel file,
 * and uploads the updated Excel file to Google Drive.
 */
  private async purgeListToDateExtract(
    bankDataList: ScotiaDataBank[],
  ): Promise<void> {
    const extractDateString: string = formatDateString(
      this.bankValues.extractDate,
      DATE_FORMAT_BACKSLASH_DD_MM_YYYY,
    );
    const extractDate: Date = getFormattedDate(extractDateString);
    const indexToSlice = { init: 0, end: 0, lastIndex: 0 };

    bankDataList.forEach((data, index) => {
      const bankDateString = formatDateString(data.fecha, DATE_FORMAT_DDMMYYYY);
      const bankDate = getFormattedDate(bankDateString);

      if (
        bankDate.getMonth() == extractDate.getMonth() &&
        bankDate.getFullYear() == extractDate.getFullYear() &&
        !indexToSlice.init
      ) {
        indexToSlice.init = index;
      }

      if (
        !indexToSlice.end &&
        ((bankDate.getMonth() > extractDate.getMonth() &&
          bankDate.getFullYear() === extractDate.getFullYear()) ||
          (bankDate.getMonth() < extractDate.getMonth() &&
            bankDate.getFullYear() > extractDate.getFullYear()))
      ) {
        indexToSlice.end = index;
      }

      if (indexToSlice.init && indexToSlice.end) {
        return;
      }

      indexToSlice.lastIndex = index;
    });

    if (!indexToSlice.init) throw new Error('No data to extract');

    if (!indexToSlice.end) {
      indexToSlice.end = indexToSlice.lastIndex;
    }

    const lastIndexDateString = formatDateString(
      bankDataList[indexToSlice.end].fecha,
      DATE_FORMAT_DDMMYYYY,
    );
    const lastIndexDate = getFormattedDate(lastIndexDateString);
    if (lastIndexDate.getMonth() !== extractDate.getMonth()) {
      this.bankDataList = bankDataList.slice(
        indexToSlice.init,
        indexToSlice.end,
      );
    }
  }
}
