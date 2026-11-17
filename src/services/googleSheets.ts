import {
  DriveSpreadsheetSummary,
  ProductItem,
  ServiceFormValues,
  ServiceRecord,
  SpreadsheetInfo,
} from '../types/service';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export const EXPECTED_HEADERS = [
  'ID',
  'Fecha',
  'Cliente',
  'Vehículo',
  'Placa',
  'Procedimiento',
  'Productos Utilizados',
  'Actualizado',
];

export class AuthExpiredError extends Error {
  constructor(message = 'La sesión con Google expiró. Inicia sesión nuevamente.') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

async function authorizedFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    throw new AuthExpiredError();
  }

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const json = await res.json();
      detail = json?.error?.message || detail;
    } catch {
      // Ignore JSON parse failures on non-JSON responses
    }
    throw new Error(detail);
  }

  return res.json();
}

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function serializeProducts(items: ProductItem[]): string {
  const clean = items
    .map((item) => ({
      nombre: item.nombre.trim(),
      cantidad: item.cantidad.trim(),
    }))
    .filter((item) => item.nombre.length > 0);

  return clean
    .map((item) => (item.cantidad ? `${item.nombre} (${item.cantidad})` : item.nombre))
    .join('; ');
}

export function parseProducts(raw: string): ProductItem[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
      if (match) {
        return { nombre: match[1].trim(), cantidad: match[2].trim() };
      }
      return { nombre: part, cantidad: '' };
    });
}

function escapeSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

export async function findWorkshopSpreadsheets(
  accessToken: string
): Promise<DriveSpreadsheetSummary[]> {
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const data = await authorizedFetch(
    `${DRIVE_API}?q=${q}&orderBy=modifiedTime%20desc&pageSize=20&fields=${fields}`,
    accessToken
  );
  return data.files || [];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string,
  preferredSheetName?: string
): Promise<SpreadsheetInfo> {
  const fields = encodeURIComponent(
    'spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title,index)'
  );
  const data = await authorizedFetch(
    `${SHEETS_API}/${spreadsheetId}?fields=${fields}`,
    accessToken
  );

  const sheets: Array<{ properties: { title: string; index: number } }> = data.sheets || [];
  const availableSheets = sheets
    .sort((a, b) => a.properties.index - b.properties.index)
    .map((s) => s.properties.title);

  if (availableSheets.length === 0) {
    throw new Error('La hoja de cálculo no contiene pestañas disponibles.');
  }

  const sheetName =
    preferredSheetName && availableSheets.includes(preferredSheetName)
      ? preferredSheetName
      : availableSheets[0];

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Hoja de Taller',
    sheetName,
    availableSheets,
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

export async function createWorkshopSpreadsheet(
  accessToken: string,
  customTitle?: string
): Promise<SpreadsheetInfo> {
  const title = customTitle?.trim() || 'Registro de Servicios — Taller Automotriz';
  const sheetTitle = 'Servicios';

  const created = await authorizedFetch(SHEETS_API, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title, locale: 'es_ES' },
      sheets: [
        {
          properties: {
            title: sheetTitle,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  const spreadsheetId: string = created.spreadsheetId;
  const sheetId: number = created.sheets?.[0]?.properties?.sheetId ?? 0;

  // Write headers into row 1
  const headerRange = encodeURIComponent(`${escapeSheetName(sheetTitle)}!A1:H1`);
  await authorizedFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${headerRange}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        range: `${escapeSheetName(sheetTitle)}!A1:H1`,
        majorDimension: 'ROWS',
        values: [EXPECTED_HEADERS],
      }),
    }
  );

  // Format header row and column widths cleanly
  await authorizedFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.09, green: 0.1, blue: 0.12 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true,
                  fontSize: 10,
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 8 },
          },
        },
      ],
    }),
  });

  return {
    spreadsheetId,
    title,
    sheetName: sheetTitle,
    availableSheets: [sheetTitle],
    spreadsheetUrl:
      created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

export async function checkHeadersInitialized(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<{ hasHeaders: boolean; isEmptySheet: boolean; firstRow: string[] }> {
  const range = encodeURIComponent(`${escapeSheetName(sheetName)}!A1:H1`);
  const data = await authorizedFetch(`${SHEETS_API}/${spreadsheetId}/values/${range}`, accessToken);
  const firstRow: string[] = data.values?.[0] || [];
  if (firstRow.length === 0) {
    return { hasHeaders: false, isEmptySheet: true, firstRow: [] };
  }
  const normalized = firstRow.map((h) => h.trim().toLowerCase());
  const looksLikeOurHeaders =
    normalized.includes('cliente') &&
    normalized.includes('placa') &&
    (normalized.includes('vehículo') || normalized.includes('vehiculo'));

  return { hasHeaders: looksLikeOurHeaders, isEmptySheet: false, firstRow };
}

export async function initializeSheetHeaders(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  const range = encodeURIComponent(`${escapeSheetName(sheetName)}!A1:H1`);
  await authorizedFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        range: `${escapeSheetName(sheetName)}!A1:H1`,
        majorDimension: 'ROWS',
        values: [EXPECTED_HEADERS],
      }),
    }
  );
}

export async function fetchServiceRecords(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<ServiceRecord[]> {
  const range = encodeURIComponent(`${escapeSheetName(sheetName)}!A2:H`);
  const data = await authorizedFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}?majorDimension=ROWS`,
    accessToken
  );

  const rows: string[][] = data.values || [];
  const records: ServiceRecord[] = [];

  rows.forEach((row, index) => {
    const hasContent = row.some((cell) => (cell ?? '').trim() !== '');
    if (!hasContent) return;

    const id = (row[0] || '').trim() || `FILA-${index + 2}`;
    const fecha = (row[1] || '').trim();
    const cliente = (row[2] || '').trim();
    const vehiculo = (row[3] || '').trim();
    const placa = (row[4] || '').trim().toUpperCase();
    const procedimiento = (row[5] || '').trim();
    const productos = (row[6] || '').trim();
    const actualizado = (row[7] || '').trim();

    records.push({
      id,
      rowNumber: index + 2,
      fecha,
      cliente,
      vehiculo,
      placa,
      procedimiento,
      productos,
      productosLista: parseProducts(productos),
      actualizado,
    });
  });

  // Sort most recent service date first, then highest rowNumber
  return records.sort((a, b) => {
    const dateCompare = b.fecha.localeCompare(a.fecha);
    if (dateCompare !== 0) return dateCompare;
    return b.rowNumber - a.rowNumber;
  });
}

function generateServiceId(fecha: string): string {
  const datePart = fecha.replace(/-/g, '').slice(2, 8) || '000000';
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SRV-${datePart}-${randomPart}`;
}

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

export async function appendServiceRecord(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  values: ServiceFormValues
): Promise<ServiceRecord> {
  const id = generateServiceId(values.fecha);
  const productos = serializeProducts(values.productosLista);
  const actualizado = formatTimestamp();
  const placa = values.placa.trim().toUpperCase();

  const rowValues = [
    id,
    values.fecha,
    values.cliente.trim(),
    values.vehiculo.trim(),
    placa,
    values.procedimiento.trim(),
    productos,
    actualizado,
  ];

  const range = encodeURIComponent(`${escapeSheetName(sheetName)}!A:H`);
  const res = await authorizedFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    }
  );

  // Extract appended row number from updatedRange (e.g. "Servicios!A5:H5")
  const updatedRange: string = res?.updates?.updatedRange || '';
  const rowMatch = updatedRange.match(/![A-Z]+(\d+):/);
  const rowNumber = rowMatch ? parseInt(rowMatch[1], 10) : 2;

  return {
    id,
    rowNumber,
    fecha: values.fecha,
    cliente: values.cliente.trim(),
    vehiculo: values.vehiculo.trim(),
    placa,
    procedimiento: values.procedimiento.trim(),
    productos,
    productosLista: parseProducts(productos),
    actualizado,
  };
}

export async function updateServiceRecord(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  existing: ServiceRecord,
  updated: ServiceFormValues
): Promise<ServiceRecord> {
  const productos = serializeProducts(updated.productosLista);
  const actualizado = formatTimestamp();
  const placa = updated.placa.trim().toUpperCase();

  const rowValues = [
    existing.id,
    updated.fecha,
    updated.cliente.trim(),
    updated.vehiculo.trim(),
    placa,
    updated.procedimiento.trim(),
    productos,
    actualizado,
  ];

  const rangeStr = `${escapeSheetName(sheetName)}!A${existing.rowNumber}:H${existing.rowNumber}`;
  const encodedRange = encodeURIComponent(rangeStr);

  await authorizedFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        range: rangeStr,
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    }
  );

  return {
    id: existing.id,
    rowNumber: existing.rowNumber,
    fecha: updated.fecha,
    cliente: updated.cliente.trim(),
    vehiculo: updated.vehiculo.trim(),
    placa,
    procedimiento: updated.procedimiento.trim(),
    productos,
    productosLista: parseProducts(productos),
    actualizado,
  };
}
