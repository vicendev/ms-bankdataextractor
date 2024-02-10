export interface FileGoogleDrive {
  kind: string,
  mimeType: string,
  id: string,
  name: string
}

export interface DownloadFileDrive {
  url: string,
  bearerToken: string,
  mimeType: string
}