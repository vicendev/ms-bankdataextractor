import { Injectable } from '@nestjs/common';

import { drive_v3, google, sheets_v4 } from 'googleapis';

import apikey from '../config/oauth.json';
import { FileProcesorService } from 'src/file-procesor/file-procesor.service';

@Injectable()
export class GoogleDriveService {

  sheetRange: string = 'A3:D'
  spreadsheetId: string = '';
  constructor(
    private fileProcessorService: FileProcesorService,
  ) {}

  async authorize() {
    try {
      const oauth2Client = new google.auth.OAuth2({
        clientId: apikey.client_id,
        clientSecret: apikey.client_secret,
        redirectUri: apikey.redirect_url,
      });
      await oauth2Client.setCredentials({
        refresh_token: apikey.refresh_token,
      });

      return oauth2Client;
    } catch (e) {
      console.log(e);
    }
  }

  async getFilesFromFolder(auth): Promise<drive_v3.Schema$File[]> {
    return new Promise((resolve, rejects) => {
      const drive = google.drive({ version: 'v3', auth });

      drive.files.list(
        {
          q: "parents = '1ZBhqaYLRvgToee3PaJAmSkdrK0jIvLBy'",
        },
        (err, files) => {
          if (err) {
            console.log(err);
            return rejects(err);
          }
          resolve(files.data.files);
        },
      );
    });
  }

  downloadFileById(auth, fileId): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      const drive = google.drive({ version: 'v3', auth });
  
      try {
        const fileMetaData = await drive.files.get({
          fileId: fileId,
          fields: 'name',
        });
  
        const fileStream = await this.fileProcessorService.downloadFileToLocal(
          fileMetaData.data.name,
        );
  
        const file = await drive.files.get({
          fileId,
          alt: 'media'
        }, {
          responseType: "stream"
        });
  
        // Pipe the file data to the write stream
        file.data.pipe(fileStream);
  
        // Wait for the 'finish' event to ensure the write stream is complete
        fileStream.on('finish', () => {
          console.log('WriteStream finished');
          resolve(fileStream.path as string);
        });
  
        // Handle errors during the pipe operation
        file.data.on('error', (err) => {
          console.error('Error during file stream:', err);
          reject(err);
        });
  
      } catch (error) {
        console.error('Error during file download:', error);
        reject(error);
      }
    });
  }

  async uploadFile(auth, name) {

    const drive = google.drive({ version: 'v3', auth });

    const requestBody = {
      name: 'admin_mensual_test_upload.xlsx',
      parents: ['1ZBhqaYLRvgToee3PaJAmSkdrK0jIvLBy']
    };
  
    const media = {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: await this.fileProcessorService.invokeCreateReadStream(name),
    };
  
    const result = await drive.files.create({
      requestBody,
      media
    });

    return result;
  }

  async getGoogleSpreadSheet(auth): Promise<sheets_v4.Schema$Spreadsheet> {

    const sheets = google.sheets({ version: 'v4', auth});

    const spreadsheetFile = await sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    if (!spreadsheetFile.data) throw new Error("No spread sheet file to read");

    return spreadsheetFile.data;
  }

  async getGoogleSpreadSheetValues(auth, sheetTile: string) {
    const sheets = google.sheets({ version: 'v4', auth});

    const sheetFile = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetTile}!${this.sheetRange}`
    });

    return sheetFile.data.values;
  }

  async updateGoogleSpreadSheetValues(auth, sheetTile: string, updateSheetValues: Array<any>) {
    const sheets = google.sheets({ version: 'v4', auth});

    const sheetFile = await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetTile}!${this.sheetRange}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { range: `${sheetTile}!${this.sheetRange}`, majorDimension: "ROWS", values: updateSheetValues },
    });

    return sheetFile;
  }
}
