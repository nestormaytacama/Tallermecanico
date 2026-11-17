export interface ProductItem {
  nombre: string;
  cantidad: string;
}

export interface ServiceRecord {
  id: string;
  rowNumber: number;
  fecha: string;
  cliente: string;
  vehiculo: string;
  placa: string;
  procedimiento: string;
  productos: string;
  productosLista: ProductItem[];
  actualizado: string;
}

export interface ServiceFormValues {
  fecha: string;
  cliente: string;
  vehiculo: string;
  placa: string;
  procedimiento: string;
  productosLista: ProductItem[];
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  sheetName: string;
  availableSheets: string[];
  spreadsheetUrl: string;
}

export interface DriveSpreadsheetSummary {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}
