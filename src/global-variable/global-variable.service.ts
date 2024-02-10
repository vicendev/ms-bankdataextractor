import { Injectable } from '@nestjs/common';
import { BankValuesGlobal } from 'src/interface/global-variable.interface';

@Injectable()
export class GlobalVariableService {

  constructor(){}

  private bankValues: BankValuesGlobal = {
    extractDate: "",
    excelDate: "",
    excelExpenditure: 0,
    excelIncome: 0
  };

  getBankValues(): BankValuesGlobal {
    return this.bankValues;
  }

  setBankValues(value: BankValuesGlobal): void {
    this.bankValues = value;
  }
}
