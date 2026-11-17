import React, { useMemo, useState } from 'react';
import { Eye, Pencil, Plus, RefreshCw, Search, ArrowUpDown } from 'lucide-react';
import { ServiceRecord } from '../types/service';

interface ServiceHistoryTableProps {
  records: ServiceRecord[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCreateNew: () => void;
  onInspect: (record: ServiceRecord) => void;
  onEdit: (record: ServiceRecord) => void;
}

type SortKey = 'fecha' | 'cliente' | 'placa';

export const ServiceHistoryTable: React.FC<ServiceHistoryTableProps> = ({
  records,
  isLoading,
  error,
  onRefresh,
  onCreateNew,
  onInspect,
  onEdit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('fecha');
  const [sortAsc, setSortAsc] = useState(false);

  // Extract distinct YYYY-MM values for filter dropdown
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    records.forEach((r) => {
      if (r.fecha && /^\d{4}-\d{2}/.test(r.fecha)) {
        months.add(r.fecha.slice(0, 7));
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [records]);

  // Metrics calculated directly from loaded sheet rows
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
    const thisMonthCount = records.filter((r) =>
      r.fecha.startsWith(currentMonth)
    ).length;
    const uniqueVehicles = new Set(
      records.map((r) => r.placa.trim().toUpperCase()).filter(Boolean)
    ).size;

    return {
      total: records.length,
      thisMonth: thisMonthCount,
      uniqueVehicles,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = records.filter((r) => {
      if (monthFilter !== 'all' && !r.fecha.startsWith(monthFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        r.cliente.toLowerCase().includes(q) ||
        r.vehiculo.toLowerCase().includes(q) ||
        r.placa.toLowerCase().includes(q) ||
        r.procedimiento.toLowerCase().includes(q) ||
        r.productos.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      const valA = a[sortKey] || '';
      const valB = b[sortKey] || '';
      const cmp = valA.localeCompare(valB, 'es');
      return sortAsc ? cmp : -cmp;
    });
  }, [records, searchQuery, monthFilter, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key !== 'fecha');
    }
  };

  return (
    <div className="space-y-6">
      {/* Unboxed summary strip separated by hairline borders */}
      <div className="grid grid-cols-1 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-6 py-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Total de servicios
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            {isLoading ? '—' : stats.total}
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Servicios este mes
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            {isLoading ? '—' : stats.thisMonth}
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Vehículos atendidos
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            {isLoading ? '—' : stats.uniqueVehicles}
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por placa, cliente, vehículo, procedimiento o producto..."
            className="min-h-[40px] w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            aria-label="Filtrar por mes"
            className="min-h-[40px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-orange-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <option value="all">Todos los meses</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-zinc-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* High-density Service History Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {isLoading ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            <div className="grid grid-cols-6 gap-4 bg-zinc-50 px-5 py-3 text-xs font-semibold text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
              <span>Fecha</span>
              <span>Placa</span>
              <span>Cliente</span>
              <span>Vehículo</span>
              <span>Procedimiento</span>
              <span className="text-right">Acciones</span>
            </div>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="grid h-[44px] grid-cols-6 items-center gap-4 px-5"
              >
                <div className="h-3.5 w-20 rounded bg-zinc-200/70 dark:bg-zinc-800" />
                <div className="h-3.5 w-16 rounded bg-zinc-200/70 dark:bg-zinc-800" />
                <div className="h-3.5 w-28 rounded bg-zinc-200/70 dark:bg-zinc-800" />
                <div className="h-3.5 w-32 rounded bg-zinc-200/70 dark:bg-zinc-800" />
                <div className="h-3.5 w-40 rounded bg-zinc-200/70 dark:bg-zinc-800" />
                <div className="ml-auto h-3.5 w-20 rounded bg-zinc-200/70 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Aún no hay servicios registrados en esta hoja
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Registra el primer servicio con los datos del cliente, vehículo, placa,
              procedimiento y productos utilizados para comenzar tu historial.
            </p>
            <button
              type="button"
              onClick={onCreateNew}
              className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-md bg-orange-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-800 whitespace-nowrap shrink-0 dark:bg-orange-600 dark:hover:bg-orange-500"
            >
              <Plus className="h-4 w-4" />
              Registrar primer servicio
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              No se encontraron coincidencias
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Prueba con otro término de búsqueda o limpia los filtros activos.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setMonthFilter('all');
              }}
              className="mt-4 min-h-[40px] rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('fecha')}
                      className="inline-flex items-center gap-1 hover:text-zinc-900 whitespace-nowrap dark:hover:text-zinc-100"
                    >
                      Fecha
                      <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('placa')}
                      className="inline-flex items-center gap-1 hover:text-zinc-900 whitespace-nowrap dark:hover:text-zinc-100"
                    >
                      Placa
                      <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('cliente')}
                      className="inline-flex items-center gap-1 hover:text-zinc-900 whitespace-nowrap dark:hover:text-zinc-100"
                    >
                      Cliente
                      <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                    </button>
                  </th>
                  <th className="px-4 py-3">Vehículo</th>
                  <th className="px-4 py-3">Procedimiento</th>
                  <th className="px-4 py-3">Productos</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredRecords.map((record) => (
                  <tr
                    key={`${record.id}-${record.rowNumber}`}
                    onClick={() => onInspect(record)}
                    className="h-[44px] cursor-pointer bg-white transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/70"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-600 tabular-nums whitespace-nowrap dark:text-zinc-400">
                      {record.fecha || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold tracking-wider text-zinc-900 whitespace-nowrap dark:text-zinc-100">
                      {record.placa || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-zinc-900 max-w-[180px] truncate dark:text-zinc-100">
                      {record.cliente || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700 max-w-[180px] truncate dark:text-zinc-300">
                      {record.vehiculo || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 max-w-[240px] truncate dark:text-zinc-400">
                      {record.procedimiento || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500 tabular-nums whitespace-nowrap dark:text-zinc-400">
                      {record.productosLista.length > 0
                        ? `${record.productosLista.length} ${
                            record.productosLista.length === 1 ? 'producto' : 'productos'
                          }`
                        : 'Sin insumos'}
                    </td>
                    <td
                      className="px-4 py-2.5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onInspect(record)}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        >
                          <Eye className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                          Consultar
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(record)}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800 whitespace-nowrap shrink-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-orange-700 dark:hover:bg-orange-950/50 dark:hover:text-orange-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
