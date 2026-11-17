import React from 'react';
import { X, Pencil, ExternalLink } from 'lucide-react';
import { ServiceRecord } from '../types/service';

interface ServiceDetailDrawerProps {
  record: ServiceRecord | null;
  spreadsheetUrl?: string;
  onClose: () => void;
  onEdit: (record: ServiceRecord) => void;
}

export const ServiceDetailDrawer: React.FC<ServiceDetailDrawerProps> = ({
  record,
  spreadsheetUrl,
  onClose,
  onEdit,
}) => {
  if (!record) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-zinc-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-drawer-title"
    >
      <div className="flex h-full w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
              <span>{record.id}</span>
              <span aria-hidden="true">·</span>
              <span>Fila {record.rowNumber}</span>
              <span aria-hidden="true">·</span>
              <span>{record.fecha}</span>
            </div>
            <h2
              id="detail-drawer-title"
              className="mt-1.5 text-xl font-semibold text-zinc-900 truncate dark:text-zinc-100"
            >
              {record.vehiculo || 'Vehículo sin especificar'}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Cliente:{' '}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {record.cliente}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Cerrar detalle"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Core metadata grid */}
          <dl className="grid grid-cols-2 gap-4 rounded-md border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Placa</dt>
              <dd className="mt-1 font-mono text-base font-semibold tracking-wider text-zinc-900 dark:text-zinc-100">
                {record.placa || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Fecha de servicio
              </dt>
              <dd className="mt-1 font-mono text-sm font-medium text-zinc-900 tabular-nums dark:text-zinc-100">
                {record.fecha || '—'}
              </dd>
            </div>
            <div className="col-span-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Cliente
              </dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {record.cliente || '—'}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Vehículo
              </dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {record.vehiculo || '—'}
              </dd>
            </div>
          </dl>

          {/* Procedure */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Procedimiento realizado
            </h3>
            <div className="mt-2 rounded-md border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300">
              {record.procedimiento || 'Sin descripción registrada.'}
            </div>
          </div>

          {/* Products used */}
          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Productos utilizados
              </h3>
              <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                {record.productosLista.length}{' '}
                {record.productosLista.length === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>

            {record.productosLista.length > 0 ? (
              <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                      <th className="px-4 py-2.5">Producto / Insumo</th>
                      <th className="px-4 py-2.5 text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {record.productosLista.map((item, idx) => (
                      <tr
                        key={`${item.nombre}-${idx}`}
                        className="bg-white dark:bg-zinc-900"
                      >
                        <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                          {item.nombre}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-600 tabular-nums dark:text-zinc-300">
                          {item.cantidad || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                No se registraron productos para este servicio.
              </div>
            )}
          </div>

          {record.actualizado && (
            <p className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
              Última actualización en hoja de cálculo: {record.actualizado}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          {spreadsheetUrl ? (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 whitespace-nowrap shrink-0 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir Google Sheet
            </a>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => onEdit(record)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-orange-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-800 whitespace-nowrap shrink-0 dark:bg-orange-600 dark:hover:bg-orange-500"
            >
              <Pencil className="h-4 w-4" />
              Editar registro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
