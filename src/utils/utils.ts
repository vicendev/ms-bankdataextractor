import moment from 'moment';
import { DATE_FORMAT_BACKSLASH_DD_MM_YYYY } from 'src/constants/date-format.constant';

export function getMonthName() {
  const date = new Date();
  return date.toLocaleDateString('es-ES', { month: 'long' });
}

export function getMonthNameAndYear(extractDate: string) {
  const date = moment(extractDate, DATE_FORMAT_BACKSLASH_DD_MM_YYYY).toDate();

  const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(
    date,
  );
  const monthNameCapitalized =
    monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const year = date.getFullYear();

  return `${monthNameCapitalized} ${year}`;
}

export function formatDateString(originalDate: string, format: string): string {
  const date = moment.utc(originalDate, format);
  const formattedDate = date.format(DATE_FORMAT_BACKSLASH_DD_MM_YYYY);

  return formattedDate;
}

export function getFormattedDate(dateString: string) {
  return moment(dateString, DATE_FORMAT_BACKSLASH_DD_MM_YYYY).toDate();
}

export function isValidDateFormat(dateString) {
  const parsedDate = moment(dateString, DATE_FORMAT_BACKSLASH_DD_MM_YYYY, true); // El tercer parámetro (true) habilita el modo estricto

  return (
    parsedDate.isValid() &&
    parsedDate.format(DATE_FORMAT_BACKSLASH_DD_MM_YYYY) === dateString
  );
}

export function convertCurrencyStringToNumber(currencyString: string): number {
  const numberValue = Number(currencyString.replace(/[^\d]/g, ''));
  return isNaN(numberValue) ? 0 : numberValue;
}

export function convertMountScotiaData(value: String) {
  return parseFloat(value.replace(/^0+/, '').replace(',', '.'));
}
