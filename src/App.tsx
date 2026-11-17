import React, { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ClipboardList,
  PlusCircle,
  FileSpreadsheet,
  ExternalLink,
  LogOut,
  Menu,
  X,
  CheckCircle2,
  Settings2,
  Wrench,
  Sun,
  Moon,
} from 'lucide-react';
import {
  DriveSpreadsheetSummary,
  ServiceFormValues,
  ServiceRecord,
  SpreadsheetInfo,
} from './types/service';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  invalidateAccessToken,
  logout,
} from './services/googleAuth';
import {
  appendServiceRecord,
  AuthExpiredError,
  checkHeadersInitialized,
  createWorkshopSpreadsheet,
  fetchServiceRecords,
  findWorkshopSpreadsheets,
  getSpreadsheetMetadata,
  initializeSheetHeaders,
  updateServiceRecord,
} from './services/googleSheets';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { ServiceHistoryTable } from './components/ServiceHistoryTable';
import { ServiceForm } from './components/ServiceForm';
import { ServiceDetailDrawer } from './components/ServiceDetailDrawer';
import { SheetConnectorModal } from './components/SheetConnectorModal';
import { ConfirmModal } from './components/ConfirmModal';

type WorkspaceView = 'history' | 'form';
type ThemeMode = 'light' | 'dark';

interface SavedSheetPreference {
  spreadsheetId: string;
  sheetName?: string;
}

const SHEET_PREF_KEY = 'autoregistro_taller_sheet_pref';
const THEME_STORAGE_KEY = 'autoregistro_theme';
const WORKSHOP_IMAGE_PATH = '/src/assets/images/workshop_service_bay_1794876155770.jpg';

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Ignore storage access errors
  }
  return 'light';
}

function loadSheetPreference(): SavedSheetPreference | null {
  try {
    const raw = localStorage.getItem(SHEET_PREF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.spreadsheetId === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveSheetPreference(pref: SavedSheetPreference) {
  try {
    localStorage.setItem(SHEET_PREF_KEY, JSON.stringify(pref));
  } catch {
    // Ignore storage quota errors
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [view, setView] = useState<WorkspaceView>('history');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const [spreadsheetInfo, setSpreadsheetInfo] = useState<SpreadsheetInfo | null>(null);
  const [driveSheets, setDriveSheets] = useState<DriveSpreadsheetSummary[]>([]);
  const [connectorOpen, setConnectorOpen] = useState<boolean>(false);
  const [connectorLoading, setConnectorLoading] = useState<boolean>(false);
  const [connectorError, setConnectorError] = useState<string | null>(null);

  const [pendingHeaderInit, setPendingHeaderInit] = useState<{
    info: SpreadsheetInfo;
  } | null>(null);

  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState<boolean>(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [inspectedRecord, setInspectedRecord] = useState<ServiceRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage access errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleAuthExpired = useCallback(() => {
    invalidateAccessToken();
    setNeedsAuth(true);
    setAuthError(
      'Tu sesión de acceso con Google expiró. Inicia sesión nuevamente para continuar.'
    );
  }, []);

  const loadRecordsForSheet = useCallback(
    async (token: string, info: SpreadsheetInfo) => {
      setRecordsLoading(true);
      setRecordsError(null);
      try {
        const list = await fetchServiceRecords(
          token,
          info.spreadsheetId,
          info.sheetName
        );
        setRecords(list);
      } catch (err: unknown) {
        if (err instanceof AuthExpiredError) {
          handleAuthExpired();
          return;
        }
        setRecordsError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar el historial desde Google Sheets.'
        );
      } finally {
        setRecordsLoading(false);
      }
    },
    [handleAuthExpired]
  );

  const connectSpreadsheet = useCallback(
    async (token: string, spreadsheetId: string, preferredSheetName?: string) => {
      setConnectorLoading(true);
      setConnectorError(null);
      try {
        const info = await getSpreadsheetMetadata(
          token,
          spreadsheetId,
          preferredSheetName
        );
        const headerState = await checkHeadersInitialized(
          token,
          info.spreadsheetId,
          info.sheetName
        );

        if (headerState.isEmptySheet) {
          setPendingHeaderInit({ info });
          setConnectorLoading(false);
          return;
        }

        setSpreadsheetInfo(info);
        saveSheetPreference({
          spreadsheetId: info.spreadsheetId,
          sheetName: info.sheetName,
        });
        setConnectorOpen(false);
        await loadRecordsForSheet(token, info);
      } catch (err: unknown) {
        if (err instanceof AuthExpiredError) {
          handleAuthExpired();
          return;
        }
        setConnectorError(
          err instanceof Error
            ? err.message
            : 'No se pudo acceder a la hoja de cálculo seleccionada.'
        );
        setConnectorOpen(true);
      } finally {
        setConnectorLoading(false);
      }
    },
    [handleAuthExpired, loadRecordsForSheet]
  );

  const bootstrapSession = useCallback(
    async (token: string) => {
      try {
        const discovered = await findWorkshopSpreadsheets(token);
        setDriveSheets(discovered);

        const savedPref = loadSheetPreference();
        if (savedPref?.spreadsheetId) {
          await connectSpreadsheet(
            token,
            savedPref.spreadsheetId,
            savedPref.sheetName
          );
          return;
        }

        if (discovered.length > 0) {
          await connectSpreadsheet(token, discovered[0].id);
          return;
        }

        // No existing spreadsheet found — prompt user to create or link one
        setConnectorOpen(true);
      } catch (err: unknown) {
        if (err instanceof AuthExpiredError) {
          handleAuthExpired();
          return;
        }
        setConnectorOpen(true);
      }
    },
    [connectSpreadsheet, handleAuthExpired]
  );

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setNeedsAuth(false);
        setAuthError(null);
        void bootstrapSession(token);
      },
      () => {
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, [bootstrapSession]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setNeedsAuth(false);
      await bootstrapSession(result.accessToken);
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el inicio de sesión con Google.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setSpreadsheetInfo(null);
    setRecords([]);
    setInspectedRecord(null);
    setEditingRecord(null);
    setView('history');
  };

  const handleCreateNewSheet = async (customTitle: string) => {
    const token = await getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }
    setConnectorLoading(true);
    setConnectorError(null);
    try {
      const info = await createWorkshopSpreadsheet(token, customTitle);
      setSpreadsheetInfo(info);
      saveSheetPreference({
        spreadsheetId: info.spreadsheetId,
        sheetName: info.sheetName,
      });
      const updatedList = await findWorkshopSpreadsheets(token);
      setDriveSheets(updatedList);
      setConnectorOpen(false);
      setRecords([]);
      setBannerMessage(`Hoja "${info.title}" creada y conectada correctamente.`);
    } catch (err: unknown) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired();
        return;
      }
      setConnectorError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear la nueva hoja de cálculo.'
      );
    } finally {
      setConnectorLoading(false);
    }
  };

  const handleConnectById = async (spreadsheetId: string, sheetName?: string) => {
    const token = await getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }
    await connectSpreadsheet(token, spreadsheetId, sheetName);
  };

  const handleChangeTab = async (newTabName: string) => {
    if (!spreadsheetInfo) return;
    const token = await getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }
    await connectSpreadsheet(token, spreadsheetInfo.spreadsheetId, newTabName);
  };

  const handleConfirmHeaderInit = async () => {
    if (!pendingHeaderInit) return;
    const token = await getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }
    setConnectorLoading(true);
    try {
      const { info } = pendingHeaderInit;
      await initializeSheetHeaders(token, info.spreadsheetId, info.sheetName);
      setPendingHeaderInit(null);
      setSpreadsheetInfo(info);
      saveSheetPreference({
        spreadsheetId: info.spreadsheetId,
        sheetName: info.sheetName,
      });
      setConnectorOpen(false);
      await loadRecordsForSheet(token, info);
      setBannerMessage(
        `Encabezados preparados en la pestaña "${info.sheetName}".`
      );
    } catch (err: unknown) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired();
        return;
      }
      setConnectorError(
        err instanceof Error
          ? err.message
          : 'No se pudieron escribir los encabezados en la hoja.'
      );
    } finally {
      setConnectorLoading(false);
    }
  };

  const handleRefreshRecords = async () => {
    if (!spreadsheetInfo) return;
    const token = await getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }
    await loadRecordsForSheet(token, spreadsheetInfo);
  };

  const handleSaveNewService = async (values: ServiceFormValues) => {
    if (!spreadsheetInfo) return;
    const token = await getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }
    setIsSubmitting(true);
    setRecordsError(null);
    try {
      const created = await appendServiceRecord(
        token,
        spreadsheetInfo.spreadsheetId,
        spreadsheetInfo.sheetName,
        values
      );
      await loadRecordsForSheet(token, spreadsheetInfo);
      setView('history');
      setEditingRecord(null);
      setBannerMessage(
        `Servicio ${created.id} (${created.placa}) guardado en Google Sheets.`
      );
    } catch (err: unknown) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired();
        return;
      }
      setRecordsError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el registro en Google Sheets.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEditedService = async (
    existing: ServiceRecord,
    values: ServiceFormValues
  ) => {
    if (!spreadsheetInfo) return;
    const token = await getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }
    setIsSubmitting(true);
    setRecordsError(null);
    try {
      const updated = await updateServiceRecord(
        token,
        spreadsheetInfo.spreadsheetId,
        spreadsheetInfo.sheetName,
        existing,
        values
      );
      await loadRecordsForSheet(token, spreadsheetInfo);
      setEditingRecord(null);
      setView('history');
      setBannerMessage(
        `Registro ${updated.id} (fila ${updated.rowNumber}) actualizado en Google Sheets.`
      );
    } catch (err: unknown) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired();
        return;
      }
      setRecordsError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el registro en Google Sheets.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenNewForm = () => {
    setEditingRecord(null);
    setInspectedRecord(null);
    setView('form');
    setMobileMenuOpen(false);
  };

  const handleOpenEditForm = (record: ServiceRecord) => {
    setInspectedRecord(null);
    setEditingRecord(record);
    setView('form');
    setMobileMenuOpen(false);
  };

  // Unauthenticated Welcome & Connect Screen
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#F6F7F8] dark:bg-zinc-950 flex items-center justify-center p-4 sm:p-8 transition-colors duration-150">
        <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm grid grid-cols-1 lg:grid-cols-2 items-stretch dark:border-zinc-800 dark:bg-zinc-900">
          {/* Left visual panel */}
          <div className="relative min-h-[240px] lg:min-h-[540px] bg-zinc-900 overflow-hidden">
            {!heroImgFailed ? (
              <img
                src={WORKSHOP_IMAGE_PATH}
                alt="Bahía de servicio automotriz moderna"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 p-8 text-zinc-200">
                <Wrench className="h-12 w-12 text-orange-500" />
                <p className="mt-4 text-sm font-medium">AutoRegistro Taller</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-zinc-950/35 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
              <p className="text-xs font-medium tracking-wide text-zinc-300">
                Bitácora operativa para talleres automotrices
              </p>
              <p className="mt-1.5 text-lg font-semibold leading-snug">
                Control preciso de vehículos, procedimientos e insumos en tu propio Google Sheet.
              </p>
            </div>
          </div>

          {/* Right sign-in panel */}
          <div className="flex flex-col justify-center p-8 sm:p-12">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                AutoRegistro
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-400" />
                    Modo claro
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-zinc-600" />
                    Modo oscuro
                  </>
                )}
              </button>
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 [text-wrap:balance] dark:text-zinc-100">
              Gestiona los servicios de tu taller automotriz
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Registra ingresos de vehículos con cliente, placa, fecha, procedimiento e insumos
              utilizados. Toda la información se guarda y consulta directamente en Google Sheets.
            </p>

            <ul className="mt-6 space-y-2.5 border-y border-zinc-200 py-5 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
              <li className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-orange-700 dark:text-orange-400">
                  01
                </span>
                <span>Registro completo de cliente, vehículo, placa y fecha</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-orange-700 dark:text-orange-400">
                  02
                </span>
                <span>Detalle de procedimientos y productos utilizados</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-orange-700 dark:text-orange-400">
                  03
                </span>
                <span>Historial en vivo con consulta y edición directa en Google Sheets</span>
              </li>
            </ul>

            {authError && (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                {authError}
              </div>
            )}

            <div className="mt-6">
              <GoogleSignInButton
                onClick={handleLogin}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Conectando con Google...' : 'Sign in with Google'}
              />
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Se solicitará tu permiso para crear y actualizar hojas de cálculo en tu cuenta de Google.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F8] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex transition-colors duration-150">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-zinc-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Workspace Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 dark:border-zinc-800 dark:bg-zinc-900 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
          <span className="text-lg font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 dark:text-zinc-100">
            AutoRegistro
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <button
            type="button"
            onClick={() => {
              setEditingRecord(null);
              setView('history');
              setMobileMenuOpen(false);
            }}
            className={`flex w-full min-h-[42px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              view === 'history'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            }`}
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            Historial de servicios
          </button>

          <button
            type="button"
            onClick={handleOpenNewForm}
            className={`flex w-full min-h-[42px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              view === 'form' && !editingRecord
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            }`}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            Registrar servicio
          </button>
        </nav>

        {/* Connected Google Sheet Info */}
        <div className="border-t border-zinc-200 p-4 space-y-3 dark:border-zinc-800">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Hoja conectada
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {spreadsheetInfo?.title || 'Sin hoja seleccionada'}
              </p>
              {spreadsheetInfo && (
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  Pestaña: {spreadsheetInfo.sheetName}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {spreadsheetInfo?.spreadsheetUrl && (
              <a
                href={spreadsheetInfo.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[34px] items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span>Abrir Google Sheet</span>
                <ExternalLink className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setConnectorError(null);
                setConnectorOpen(true);
                setMobileMenuOpen(false);
              }}
              className="inline-flex min-h-[34px] items-center justify-between rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span>Cambiar o configurar hoja</span>
              <Settings2 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Theme Switcher + User Account Footer */}
        <div className="border-t border-zinc-200 p-4 space-y-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="flex w-full min-h-[36px] items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
            {theme === 'dark' ? (
              <Sun className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-zinc-600" />
            )}
          </button>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {user?.displayName || 'Cuenta Google'}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {user?.email || ''}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract: Breadcrumb on left, max 1 primary CTA on right */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 sm:px-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-zinc-500 truncate dark:text-zinc-400">
              <span className="hidden sm:inline">Taller Automotriz</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-zinc-900 truncate dark:text-zinc-100">
                {view === 'history'
                  ? 'Historial de servicios'
                  : editingRecord
                    ? `Editar ${editingRecord.id}`
                    : 'Registrar servicio'}
              </span>
            </div>
          </div>

          {view === 'history' && spreadsheetInfo && (
            <button
              type="button"
              onClick={handleOpenNewForm}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-orange-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-800 focus-visible:outline-2 focus-visible:outline-orange-600 whitespace-nowrap shrink-0 dark:bg-orange-600 dark:hover:bg-orange-500"
            >
              <PlusCircle className="h-4 w-4" />
              Nuevo servicio
            </button>
          )}
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            {bannerMessage && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  <span>{bannerMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBannerMessage(null)}
                  className="rounded p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                  aria-label="Ocultar notificación"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {!spreadsheetInfo ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <FileSpreadsheet className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-500" />
                <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Conecta una hoja de Google Sheets para comenzar
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                  Puedes crear una hoja nueva lista para el taller o vincular una hoja existente
                  de tu cuenta.
                </p>
                <button
                  type="button"
                  onClick={() => setConnectorOpen(true)}
                  className="mt-5 min-h-[40px] rounded-md bg-orange-700 px-5 py-2 text-sm font-medium text-white hover:bg-orange-800 dark:bg-orange-600 dark:hover:bg-orange-500"
                >
                  Configurar Google Sheets
                </button>
              </div>
            ) : view === 'history' ? (
              <ServiceHistoryTable
                records={records}
                isLoading={recordsLoading}
                error={recordsError}
                onRefresh={handleRefreshRecords}
                onCreateNew={handleOpenNewForm}
                onInspect={(rec) => setInspectedRecord(rec)}
                onEdit={handleOpenEditForm}
              />
            ) : (
              <ServiceForm
                editingRecord={editingRecord}
                existingRecords={records}
                spreadsheetInfo={spreadsheetInfo}
                isSubmitting={isSubmitting}
                onSaveNew={handleSaveNewService}
                onSaveEdit={handleSaveEditedService}
                onCancel={() => {
                  setEditingRecord(null);
                  setView('history');
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* Consult / Inspect Slide-over Drawer */}
      <ServiceDetailDrawer
        record={inspectedRecord}
        spreadsheetUrl={spreadsheetInfo?.spreadsheetUrl}
        onClose={() => setInspectedRecord(null)}
        onEdit={handleOpenEditForm}
      />

      {/* Google Sheet Selector / Creator Modal */}
      <SheetConnectorModal
        open={connectorOpen}
        canClose={Boolean(spreadsheetInfo)}
        existingSheets={driveSheets}
        currentSheet={spreadsheetInfo}
        isLoading={connectorLoading}
        error={connectorError}
        onCreateNew={handleCreateNewSheet}
        onConnectById={handleConnectById}
        onChangeTab={handleChangeTab}
        onClose={() => setConnectorOpen(false)}
      />

      {/* Explicit Confirmation before initializing Row 1 headers on an empty sheet */}
      <ConfirmModal
        open={Boolean(pendingHeaderInit)}
        title="¿Preparar columnas en esta hoja vacía?"
        description={`La pestaña "${pendingHeaderInit?.info.sheetName}" de "${pendingHeaderInit?.info.title}" está vacía. ¿Deseas escribir los encabezados del taller (ID, Fecha, Cliente, Vehículo, Placa, Procedimiento, Productos Utilizados, Actualizado) en la fila 1?`}
        details={[
          {
            label: 'Hoja de cálculo',
            value: pendingHeaderInit?.info.title || '',
          },
          {
            label: 'Pestaña',
            value: pendingHeaderInit?.info.sheetName || '',
          },
          {
            label: 'Rango a escribir',
            value: 'A1:H1',
          },
        ]}
        confirmLabel="Preparar encabezados"
        isSubmitting={connectorLoading}
        onConfirm={handleConfirmHeaderInit}
        onCancel={() => {
          setPendingHeaderInit(null);
          setConnectorOpen(true);
        }}
      />
    </div>
  );
}
