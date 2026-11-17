import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDetail {
  label: string;
  value: string;
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  details?: ConfirmDetail[];
  confirmLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  description,
  details = [],
  confirmLabel = 'Confirmar y guardar',
  cancelLabel = 'Cancelar',
  isSubmitting = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2
              id="confirm-modal-title"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-orange-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Cerrar diálogo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {description}
          </p>

          {details.length > 0 && (
            <dl className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-zinc-50/70 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/60">
              {details.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[120px_1fr] gap-3 px-3.5 py-2.5 text-xs"
                >
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    {item.label}
                  </dt>
                  <dd className="font-medium text-zinc-900 break-words dark:text-zinc-100">
                    {item.value || '—'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-lg border-t border-zinc-200 bg-zinc-50 px-6 py-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="min-h-[40px] rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-orange-600 whitespace-nowrap shrink-0 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="min-h-[40px] rounded-md bg-orange-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-800 focus-visible:outline-2 focus-visible:outline-orange-600 whitespace-nowrap shrink-0 disabled:opacity-50 dark:bg-orange-600 dark:hover:bg-orange-500"
          >
            {isSubmitting ? 'Guardando cambios...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
