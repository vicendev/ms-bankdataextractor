import { Injectable } from '@nestjs/common';

import exceljs from 'exceljs';
import { sheets_v4 } from 'googleapis';
import {
  DATE_FORMAT_BACKSLASH_DD_MM_YYYY,
  DATE_FORMAT_DDMMYYYY,
} from 'src/constants/date-format.constant';
import { GlobalVariableService } from 'src/global-variable/global-variable.service';
import { BankValuesGlobal } from 'src/interface/global-variable.interface';
import { ScotiaDataBank } from 'src/interface/scotia.extractor.interface';
import {
  convertCurrencyStringToNumber,
  convertMountScotiaData,
  formatDateString,
  getFormattedDate,
  getMonthNameAndYear,
} from 'src/utils/utils';

type LastRowSheetType = {
  row: Array<any>;
  index: number;
};

@Injectable()
export class ExcelProcessorService {
  bankValues: BankValuesGlobal;
  lastRow: exceljs.Row;
  lastRowSheet: LastRowSheetType;

  constructor(private globalVariableService: GlobalVariableService) {
    this.bankValues = this.globalVariableService.getBankValues();
  }

  async getSheetTitle(spreadSheet: sheets_v4.Schema$Spreadsheet) {
    const worksheet = await this.getSpreadWorksheet(spreadSheet);

    if (!worksheet.properties.title) throw new Error('No sheet to read');

    return worksheet.properties.title;
  }

  async readSpreadsheetValues(sheetValues: Array<any>) {
    await this.iterateSheetLastValue(sheetValues);
  }

  async writeSpreadsheetValues(
    sheetValues: Array<any>,
    bankDataList: ScotiaDataBank[],
  ) {
    return await this.iterateWriteSheetLastRow(sheetValues, bankDataList);
  }

  private async getSpreadWorksheet(spreadSheet: sheets_v4.Schema$Spreadsheet) {
    const monthAndYearName = getMonthNameAndYear(this.bankValues.extractDate);
    let worsheet: sheets_v4.Schema$Sheet;

    spreadSheet.sheets.forEach((sheet) => {
      if (
        sheet &&
        sheet.properties.title.toLowerCase() === monthAndYearName.toLowerCase()
      ) {
        worsheet = sheet;
      }
    });

    return worsheet;
  }

  private async iterateSheetLastValue(sheetValues: Array<any>) {
    if (!sheetValues[0][0]) {
      this.lastRowSheet = { row: sheetValues[0], index: 0 };
      return;
    }

    for (const [index, row] of sheetValues.entries()) {
      if (row && !row[0]) {
        this.setBankValuesLastRowSheet(this.lastRowSheet.row);
        break;
      }

      this.lastRowSheet = {
        row: row,
        index: index,
      };
    }
  }

  private async setBankValuesLastRowSheet(lastRow: Array<any>) {
    this.bankValues.excelDate = formatDateString(
      lastRow[0],
      DATE_FORMAT_BACKSLASH_DD_MM_YYYY,
    );
    this.bankValues.excelExpenditure = convertCurrencyStringToNumber(
      lastRow[1],
    );
    this.bankValues.excelIncome = convertCurrencyStringToNumber(lastRow[2]);

    this.globalVariableService.setBankValues(this.bankValues);
  }

  private async iterateWriteSheetLastRow(
    sheetValues: Array<any>,
    bankDataList: ScotiaDataBank[],
  ) {
    //console.log(bankDataList)
    const indexToIterateData = await this.searchRowToIterate(bankDataList);

    if (indexToIterateData === bankDataList.length) {
      throw new Error('No data to update.');
    }
    
    let bankDataToRead = bankDataList;

    console.log(indexToIterateData)
    if (indexToIterateData) {
      bankDataToRead = Array.from(bankDataList.slice(indexToIterateData));;
    }

    console.log(bankDataToRead)
    let rowsToWrite = new Array(bankDataToRead.length)
      .fill('')
      .map(() => new Array(4).fill(''));

    for (const [index, row] of rowsToWrite.entries()) {
      if (!bankDataToRead[index]) break;

      const date = formatDateString(
        bankDataToRead[index].fecha,
        DATE_FORMAT_DDMMYYYY,
      );
      const bankExpenditure = parseFloat(
        bankDataToRead[index].cargos.replace(/^0+/, '').replace(',', '.'),
      );
      const bankIncome = parseFloat(
        bankDataToRead[index].abonos.replace(/^0+/, '').replace(',', '.'),
      );

      row[0] = date;
      row[3] = bankDataToRead[index].descripcion.trim();

      if (bankExpenditure) {
        row[1] = bankExpenditure;
      }

      if (bankIncome) {
        row[2] = bankIncome;
      }
    }
    
    if (!sheetValues[0].length) return rowsToWrite;

    await this.formatCellMountValues(sheetValues);

    const updateSheetValues = [...sheetValues, ...rowsToWrite];

    return updateSheetValues;
  }

  private async searchRowToIterate(bankDataList: ScotiaDataBank[]) {
    let lastIndexBankData = 0;

    if (!this.lastRowSheet.row.length) return lastIndexBankData;

    const lastRowDateString = formatDateString(
      this.lastRowSheet.row[0],
      DATE_FORMAT_BACKSLASH_DD_MM_YYYY,
    );
    const lastRowExpenditure = convertCurrencyStringToNumber(
      this.lastRowSheet.row[1],
    );
    const lastRowIncome = convertCurrencyStringToNumber(
      this.lastRowSheet.row[2],
    );

    bankDataList.forEach((item, index) => {
      const bankDateString = formatDateString(item.fecha, DATE_FORMAT_DDMMYYYY);
      const bankExpenditure = convertMountScotiaData(item.cargos);
      const bankIncome = convertMountScotiaData(item.abonos);

      if (
        lastRowExpenditure &&
        bankExpenditure == lastRowExpenditure &&
        bankDateString == lastRowDateString
      ) {
        lastIndexBankData = index + 1;
      }

      if (
        lastRowIncome &&
        bankIncome == lastRowIncome &&
        bankDateString == lastRowDateString
      ) {
        lastIndexBankData = index + 1;
      }
    });

    return lastIndexBankData;
  }

  private async formatCellMountValues(originalSheet: Array<Array<any>>): Promise<void> {
    originalSheet.map((cells, index) => {
      
      if (cells[1]) {
        cells[1] = convertCurrencyStringToNumber(cells[1]);
      }

      if (cells[2]) {
        cells[2] = convertCurrencyStringToNumber(cells[2]);
      }
    })
  }

  //#region exceljs functions
  async readExcel(path: string) {
    //path = 'src/data/excel/Adm Mensual - copia.xlsx';
    const worksheet = await this.getWorksheet(path);
    await this.iterateLastRows(worksheet);
  }

  async writeExcel(path, bankDataList: ScotiaDataBank[]) {
    //path = 'src/data/excel/Adm Mensual - copia.xlsx';
    const worksheet = await this.getWorksheet(path);
    await this.iterateWriteLastRow(worksheet, bankDataList);

    await worksheet.workbook.xlsx.writeFile(path);
  }

  private async getWorksheet(path: string) {
    const workbook = new exceljs.Workbook();
    const excelFile = await workbook.xlsx.readFile(path);
    const id = await this.getWorksheetId(excelFile);
    return workbook.getWorksheet(id);
  }

  private async getWorksheetId(excelFile: exceljs.Workbook): Promise<number> {
    const monthAndYearName = getMonthNameAndYear(this.bankValues.extractDate);
    let worksheetId = 0;
    excelFile.eachSheet((worksheet, id) => {
      if (
        worksheet &&
        worksheet.name.toLowerCase() === monthAndYearName.toLowerCase()
      ) {
        worksheetId = id;
      }
    });

    return worksheetId;
  }

  private async setBankValuesLastRows(lastRow: exceljs.Row): Promise<void> {
    const lastDate = lastRow.getCell(1).value as string;
    this.bankValues.excelDate = formatDateString(lastDate, 'YYYY-MM-DD');
    this.bankValues.excelExpenditure =
      (lastRow.getCell(3).value as number) ?? 0;
    this.bankValues.excelIncome = (lastRow.getCell(4).value as number) ?? 0;

    this.globalVariableService.setBankValues(this.bankValues);
  }

  private async iterateLastRows(worksheet: exceljs.Worksheet) {
    const tableRows = worksheet.getRows(3, 300);

    if (!tableRows[0].getCell(1).value) {
      this.lastRow = tableRows[0];
      return;
    }

    for (const row of tableRows) {
      if (row && !row.getCell(1).value) {
        this.setBankValuesLastRows(this.lastRow);
        break;
      }
      this.lastRow = row;
    }
  }

  private async iterateWriteLastRow(
    worksheet: exceljs.Worksheet,
    bankDataList: ScotiaDataBank[],
  ) {
    let rowNumber = this.lastRow.number;

    if (this.lastRow.getCell(1).value) {
      rowNumber = rowNumber++;
    }
    const tableRows = worksheet.getRows(rowNumber, 300);

    for (const [index, row] of tableRows.entries()) {
      if (!bankDataList[index]) break;

      const date = formatDateString(
        bankDataList[index].fecha,
        DATE_FORMAT_DDMMYYYY,
      );
      const bankExpenditure = convertMountScotiaData(
        bankDataList[index].cargos,
      );
      const bankIncome = convertMountScotiaData(bankDataList[index].abonos);

      row.getCell(1).value = getFormattedDate(date);
      row.getCell(1).numFmt = DATE_FORMAT_BACKSLASH_DD_MM_YYYY;
      row.getCell(8).value = bankDataList[index].descripcion.trim();

      if (bankExpenditure) {
        row.getCell(3).value = bankExpenditure;
      }

      if (bankIncome) {
        row.getCell(4).value = bankIncome;
      }
    }
  }

  private async validateLastRowInBankData(bankDataList: ScotiaDataBank[]) {
    const extractDateString: string = formatDateString(
      this.bankValues.extractDate,
      DATE_FORMAT_BACKSLASH_DD_MM_YYYY,
    );
    const lastRowDateString: string = formatDateString(
      String(this.lastRow.getCell(1).value),
      DATE_FORMAT_BACKSLASH_DD_MM_YYYY,
    );

    const extractDate: Date = getFormattedDate(extractDateString);
    const lastRowDate: Date = getFormattedDate(lastRowDateString);
  }

  //#endregion
}
