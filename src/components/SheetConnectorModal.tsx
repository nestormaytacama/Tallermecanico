import React, { useState } from 'react';
import { FileSpreadsheet, Link2, Plus, X, ArrowRight } from 'lucide-react';
import { DriveSpreadsheetSummary, SpreadsheetInfo } from '../types/service';
import { extractSpreadsheetId } from '../services/googleSheets';

interface SheetConnectorModalProps {
  open: boolean;
  canClose: boolean;
  existingSheets: DriveSpreadsheetSummary[];
  currentSheet: SpreadsheetInfo | null;
  isLoading: boolean;
  error: string | null;
  onCreateNew: (customTitle: string) => Promise<void>;
  onConnectById: (spreadsheetId: string, sheetName?: string) => Promise<void>;
  onChangeTab: (sheetName: string) => Promise<void>;
  onClose: () => void;
}

export const SheetConnectorModal: React.FC<SheetConnectorModalProps> = ({
  open,
  canClose,
  existingSheets,
  currentSheet,
  isLoading,
  error,
  onCreateNew,
  onConnectById,
  onChangeTab,
  onClose,
}) => {
  const [newTitle, setNewTitle] = useState('Registro de Servicios — Taller Automotriz');
  const [urlOrId, setUrlOrId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) return null;

  const handleConnectUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const extracted = extractSpreadsheetId(urlOrId);
    if (!extracted) {
      setLocalError(
        'Ingresa un enlace válido de Google Sheets o el identificador de la hoja.'
      );
      return;
    }
    await onConnectById(extracted);
    setUrlOrId('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    await onCreateNew(newTitle);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-connector-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2
              id="sheet-connector-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Configurar Google Sheets del Taller
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Crea una hoja nueva lista para usar o vincula una hoja de cálculo existente.
            </p>
          </div>
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Cerrar configuración de Google Sheets"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {(error || localError) && (
            <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
              {localError || error}
            </div>
          )}

          {/* Switch tab if current spreadsheet has multiple tabs */}
          {currentSheet && currentSheet.availableSheets.length > 1 && (
            <div className="bg-zinc-50/60 px-6 py-5 dark:bg-zinc-950/40">
              <label
                htmlFor="tab-select"
                className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                Pestaña activa en &ldquo;{currentSheet.title}&rdquo;
              </label>
              <div className="mt-2 flex items-center gap-3">
                <select
                  id="tab-select"
                  value={currentSheet.sheetName}
                  disabled={isLoading}
                  onChange={(e) => onChangeTab(e.target.value)}
                  className="min-h-[40px] flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {currentSheet.availableSheets.map((tab) => (
                    <option key={tab} value={tab}>
                      {tab}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Existing app spreadsheets discovered via drive.file */}
          {existingSheets.length > 0 && (
            <div className="px-6 py-5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Hojas detectadas en tu cuenta
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Hojas de cálculo creadas o vinculadas previamente con esta aplicación.
              </p>
              <div className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {existingSheets.map((sheet) => {
                  const isCurrent = currentSheet?.spreadsheetId === sheet.id;
                  return (
                    <div
                      key={sheet.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {sheet.name}
                          </span>
                        </div>
                        {sheet.modifiedTime && (
                          <p className="mt-0.5 pl-6 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                            Modificado: {new Date(sheet.modifiedTime).toLocaleDateString('es-ES')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={isLoading || isCurrent}
                        onClick={() => onConnectById(sheet.id)}
                        className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                          isCurrent
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {isCurrent ? 'Conectada' : 'Usar esta hoja'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Option 1: Create New Spreadsheet */}
          <form onSubmit={handleCreate} className="px-6 py-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Crear nueva hoja en Google Sheets
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Genera automáticamente una hoja llamada &ldquo;Servicios&rdquo; con las columnas de
              cliente, vehículo, placa, fecha, procedimiento y productos utilizados.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                disabled={isLoading}
                placeholder="Nombre de la hoja de cálculo"
                className="min-h-[40px] flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-orange-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-800 whitespace-nowrap shrink-0 disabled:opacity-50 dark:bg-orange-600 dark:hover:bg-orange-500"
              >
                <Plus className="h-4 w-4" />
                {isLoading ? 'Creando...' : 'Crear hoja nueva'}
              </button>
            </div>
          </form>

          {/* Option 2: Connect Existing Spreadsheet by URL / ID */}
          <form onSubmit={handleConnectUrl} className="px-6 py-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Conectar mediante enlace o ID de Google Sheets
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Pega la URL completa de una hoja existente en tu cuenta de Google.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={urlOrId}
                  onChange={(e) => setUrlOrId(e.target.value)}
                  disabled={isLoading}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="min-h-[40px] w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !urlOrId.trim()}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Conectar hoja
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
