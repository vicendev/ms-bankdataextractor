import { Injectable } from '@nestjs/common';
import csvParser from 'csv-parser';
import * as fs from 'fs';

@Injectable()
export class FileProcesorService {

  processFile() {
    try {
      const filterLines = [
        ";Cartola",
        ";Numero Cuenta",
        ";Fecha Desde",
        ";Fecha Hasta",
        ";Ejecutivo",
        ";Sucursal",
        ";Email",
        ";Fono"
      ]
      const lowerCaseLines = [
        'Fecha',
        'Descripcion',
        'Cargos',
        'Abonos',
        'Saldo'
      ];

      const content = fs.readFileSync('./src/data/bsa.dat', 'utf-8');
      let lines = content.split('\n');
      
      for (const value of filterLines) {
        lines = lines.filter((line) => !line.includes(value));
      }

      lines = lines.map((line) => {
        lowerCaseLines.forEach((valor) => {
          line = line.replace(new RegExp(valor, 'g'), valor.toLowerCase());
        });
      
        return line;
      });

      const newContent = lines.join('\n');

      const fileName = `data-${new Date().getTime()}.csv`
      fs.writeFileSync(`./src/data/${fileName}`, newContent);

      return fileName;
    } catch (error) {
      return `Error al procesar el archivo: ${error.message}`;
    }
  }


  async transformCsvData (stream: fs.ReadStream, bankDataList) {
    await new Promise<void>((resolve) => {
      stream
          .pipe(csvParser({ separator: ';' }))
          .on('data', (data) => bankDataList.push(data))
          .on('end', () => {
              resolve();
          });
  });
  }

  async downloadFileToLocal(name) {
    const fileStream = fs.createWriteStream(`./src/data/excel/${name}`)
    console.log('downloading: ' + name);
    return fileStream;
  }

  async invokeCreateReadStream(name) {
    return fs.createReadStream(`./src/data/excel/${name}`)
  }
}
