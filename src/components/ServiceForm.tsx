import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ArrowLeft, Check } from 'lucide-react';
import {
  ProductItem,
  ServiceFormValues,
  ServiceRecord,
  SpreadsheetInfo,
} from '../types/service';
import { ConfirmModal } from './ConfirmModal';
import { serializeProducts } from '../services/googleSheets';

interface ServiceFormProps {
  editingRecord: ServiceRecord | null;
  existingRecords: ServiceRecord[];
  spreadsheetInfo: SpreadsheetInfo;
  isSubmitting: boolean;
  onSaveNew: (values: ServiceFormValues) => Promise<void>;
  onSaveEdit: (existing: ServiceRecord, values: ServiceFormValues) => Promise<void>;
  onCancel: () => void;
}

const PROCEDURE_PRESETS = [
  'Cambio de aceite y filtro de motor',
  'Mantenimiento preventivo de frenos',
  'Alineación y balanceo',
  'Diagnóstico electrónico con escáner',
  'Cambio de kit de distribución',
];

const PRODUCT_SUGGESTIONS: ProductItem[] = [
  { nombre: 'Aceite sintético 5W-30', cantidad: '4 L' },
  { nombre: 'Filtro de aceite', cantidad: '1 pza' },
  { nombre: 'Filtro de aire', cantidad: '1 pza' },
  { nombre: 'Pastillas de freno', cantidad: '1 juego' },
  { nombre: 'Líquido de frenos DOT 4', cantidad: '500 ml' },
];

function getTodayDateString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const ServiceForm: React.FC<ServiceFormProps> = ({
  editingRecord,
  existingRecords,
  spreadsheetInfo,
  isSubmitting,
  onSaveNew,
  onSaveEdit,
  onCancel,
}) => {
  const [cliente, setCliente] = useState('');
  const [vehiculo, setVehiculo] = useState('');
  const [placa, setPlaca] = useState('');
  const [fecha, setFecha] = useState(getTodayDateString());
  const [procedimiento, setProcedimiento] = useState('');
  const [productosLista, setProductosLista] = useState<ProductItem[]>([
    { nombre: '', cantidad: '' },
  ]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (editingRecord) {
      setCliente(editingRecord.cliente);
      setVehiculo(editingRecord.vehiculo);
      setPlaca(editingRecord.placa);
      setFecha(editingRecord.fecha || getTodayDateString());
      setProcedimiento(editingRecord.procedimiento);
      setProductosLista(
        editingRecord.productosLista.length > 0
          ? editingRecord.productosLista.map((p) => ({ ...p }))
          : [{ nombre: '', cantidad: '' }]
      );
    } else {
      setCliente('');
      setVehiculo('');
      setPlaca('');
      setFecha(getTodayDateString());
      setProcedimiento('');
      setProductosLista([{ nombre: '', cantidad: '' }]);
    }
    setValidationError(null);
  }, [editingRecord]);

  // Unique autocomplete lists from existing records
  const uniqueClients = useMemo(
    () => Array.from(new Set(existingRecords.map((r) => r.cliente).filter(Boolean))),
    [existingRecords]
  );

  const uniquePlates = useMemo(
    () => Array.from(new Set(existingRecords.map((r) => r.placa).filter(Boolean))),
    [existingRecords]
  );

  // Match known vehicle & client when typing an existing plate
  const plateMatch = useMemo(() => {
    const clean = placa.trim().toUpperCase();
    if (!clean || editingRecord) return null;
    return existingRecords.find((r) => r.placa === clean) || null;
  }, [placa, existingRecords, editingRecord]);

  const handleApplyPlateMatch = () => {
    if (!plateMatch) return;
    if (!cliente.trim()) setCliente(plateMatch.cliente);
    if (!vehiculo.trim()) setVehiculo(plateMatch.vehiculo);
  };

  const handleProductChange = (
    index: number,
    field: keyof ProductItem,
    value: string
  ) => {
    setProductosLista((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddProductRow = () => {
    setProductosLista((prev) => [...prev, { nombre: '', cantidad: '' }]);
  };

  const handleRemoveProductRow = (index: number) => {
    setProductosLista((prev) => {
      if (prev.length === 1) return [{ nombre: '', cantidad: '' }];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleQuickAddProduct = (preset: ProductItem) => {
    setProductosLista((prev) => {
      const hasOnlyEmptyRow =
        prev.length === 1 && !prev[0].nombre.trim() && !prev[0].cantidad.trim();
      if (hasOnlyEmptyRow) return [{ ...preset }];
      return [...prev, { ...preset }];
    });
  };

  const handleAppendProcedurePreset = (preset: string) => {
    setProcedimiento((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return preset;
      if (trimmed.toLowerCase().includes(preset.toLowerCase())) return prev;
      return `${trimmed}\n• ${preset}`;
    });
  };

  const buildCleanedValues = (): ServiceFormValues => ({
    cliente: cliente.trim(),
    vehiculo: vehiculo.trim(),
    placa: placa.trim().toUpperCase(),
    fecha,
    procedimiento: procedimiento.trim(),
    productosLista: productosLista
      .map((p) => ({ nombre: p.nombre.trim(), cantidad: p.cantidad.trim() }))
      .filter((p) => p.nombre.length > 0),
  });

  const validate = (): boolean => {
    if (!cliente.trim()) {
      setValidationError('Ingresa el nombre del cliente.');
      return false;
    }
    if (!vehiculo.trim()) {
      setValidationError('Ingresa la marca, modelo o descripción del vehículo.');
      return false;
    }
    if (!placa.trim()) {
      setValidationError('Ingresa la placa del vehículo.');
      return false;
    }
    if (!fecha) {
      setValidationError('Selecciona la fecha del servicio.');
      return false;
    }
    if (!procedimiento.trim()) {
      setValidationError('Describe el procedimiento que se va a realizar.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (editingRecord) {
      // Mandatory explicit confirmation modal before mutating existing data in Google Sheets
      setConfirmOpen(true);
      return;
    }

    await onSaveNew(buildCleanedValues());
  };

  const handleConfirmUpdate = async () => {
    if (!editingRecord) return;
    await onSaveEdit(editingRecord, buildCleanedValues());
    setConfirmOpen(false);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al historial
          </button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {editingRecord
              ? `Editar servicio ${editingRecord.id}`
              : 'Registrar nuevo servicio'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {editingRecord
              ? `Actualizando fila ${editingRecord.rowNumber} en la pestaña "${spreadsheetInfo.sheetName}" de Google Sheets.`
              : `La información se guardará directamente en "${spreadsheetInfo.title}" (${spreadsheetInfo.sheetName}).`}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      >
        {validationError && (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
            {validationError}
          </div>
        )}

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {/* Section 1: Client and Vehicle */}
          <div className="p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              01. Datos del cliente y vehículo
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="service-placa"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Placa
                </label>
                <input
                  id="service-placa"
                  type="text"
                  list="plates-datalist"
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                  placeholder="Ej. ABC-123"
                  disabled={isSubmitting}
                  className="mt-1.5 min-h-[42px] w-full rounded-md border border-zinc-300 bg-white px-3.5 py-2 font-mono text-sm font-semibold uppercase tracking-wider text-zinc-900 placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-400 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  required
                />
                <datalist id="plates-datalist">
                  {uniquePlates.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>

                {plateMatch && (!cliente.trim() || !vehiculo.trim()) && (
                  <button
                    type="button"
                    onClick={handleApplyPlateMatch}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Usar datos previos ({plateMatch.cliente} · {plateMatch.vehiculo})
                  </button>
                )}
              </div>

              <div>
                <label
                  htmlFor="service-fecha"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Fecha del servicio
                </label>
                <input
                  id="service-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1.5 min-h-[42px] w-full rounded-md border border-zinc-300 bg-white px-3.5 py-2 font-mono text-sm text-zinc-900 tabular-nums focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="service-cliente"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Cliente
                </label>
                <input
                  id="service-cliente"
                  type="text"
                  list="clients-datalist"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nombre completo del propietario"
                  disabled={isSubmitting}
                  className="mt-1.5 min-h-[42px] w-full rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  required
                />
                <datalist id="clients-datalist">
                  {uniqueClients.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="service-vehiculo"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Vehículo
                </label>
                <input
                  id="service-vehiculo"
                  type="text"
                  value={vehiculo}
                  onChange={(e) => setVehiculo(e.target.value)}
                  placeholder="Marca, modelo y año (ej. Toyota Hilux 2021)"
                  disabled={isSubmitting}
                  className="mt-1.5 min-h-[42px] w-full rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Procedure */}
          <div className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                02. Procedimiento que se va a realizar
              </h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Detalle técnico y observaciones
              </span>
            </div>

            <textarea
              id="service-procedimiento"
              rows={4}
              value={procedimiento}
              onChange={(e) => setProcedimiento(e.target.value)}
              disabled={isSubmitting}
              placeholder="Describe los trabajos, inspecciones o reparaciones a ejecutar..."
              className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              required
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Plantillas rápidas:
              </span>
              {PROCEDURE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAppendProcedurePreset(preset)}
                  disabled={isSubmitting}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Products used */}
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  03. Productos utilizados
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Repuestos, lubricantes o insumos empleados en el servicio.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddProductRow}
                disabled={isSubmitting}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar producto
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {productosLista.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_160px_40px]"
                >
                  <input
                    type="text"
                    value={item.nombre}
                    onChange={(e) =>
                      handleProductChange(idx, 'nombre', e.target.value)
                    }
                    disabled={isSubmitting}
                    placeholder="Nombre del producto o repuesto"
                    aria-label={`Producto ${idx + 1}`}
                    className="min-h-[40px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                  <input
                    type="text"
                    value={item.cantidad}
                    onChange={(e) =>
                      handleProductChange(idx, 'cantidad', e.target.value)
                    }
                    disabled={isSubmitting}
                    placeholder="Cant. (ej. 4 L, 1 pza)"
                    aria-label={`Cantidad ${idx + 1}`}
                    className="min-h-[40px] rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:font-sans placeholder:text-zinc-400 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveProductRow(idx)}
                    disabled={isSubmitting}
                    className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-md border border-zinc-200 text-zinc-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-red-900/60 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                    aria-label={`Eliminar producto ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Insumos frecuentes:
              </span>
              {PRODUCT_SUGGESTIONS.map((preset) => (
                <button
                  key={preset.nombre}
                  type="button"
                  onClick={() => handleQuickAddProduct(preset)}
                  disabled={isSubmitting}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 whitespace-nowrap shrink-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
                >
                  + {preset.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Form Footer */}
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-lg border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="min-h-[40px] rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[40px] rounded-md bg-orange-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-800 focus-visible:outline-2 focus-visible:outline-orange-600 whitespace-nowrap shrink-0 disabled:opacity-50 dark:bg-orange-600 dark:hover:bg-orange-500"
          >
            {isSubmitting
              ? 'Guardando en Google Sheets...'
              : editingRecord
                ? 'Actualizar registro'
                : 'Guardar en Google Sheets'}
          </button>
        </div>
      </form>

      {/* Mandatory Confirmation Dialog for Updates */}
      <ConfirmModal
        open={confirmOpen}
        title="¿Confirmar actualización en Google Sheets?"
        description={`Se sobrescribirá la fila ${editingRecord?.rowNumber} de la pestaña "${spreadsheetInfo.sheetName}" en "${spreadsheetInfo.title}".`}
        details={[
          { label: 'ID Servicio', value: editingRecord?.id || '' },
          { label: 'Fecha', value: fecha },
          { label: 'Placa', value: placa.trim().toUpperCase() },
          { label: 'Cliente', value: cliente.trim() },
          { label: 'Vehículo', value: vehiculo.trim() },
          { label: 'Procedimiento', value: procedimiento.trim() },
          {
            label: 'Productos',
            value: serializeProducts(productosLista) || 'Sin productos registrados',
          },
        ]}
        confirmLabel="Confirmar y actualizar"
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmUpdate}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
