import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import type { DashboardResult } from '../dashboardCreatorApi';
import { businessText, formatValue } from './dashboardUtils';

type TableData = DashboardResult['tables'][number];

function DashboardDataTable({ table }: { table: TableData }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => table.columns.map((column) => ({
      accessorKey: column,
      header: column,
      cell: ({ getValue }) => <span className="block max-w-[260px] truncate">{formatValue(getValue())}</span>,
    })),
    [table.columns],
  );
  const instance = useReactTable({
    data: table.rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{businessText(table.title, 'Tabla ejecutiva')}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{businessText(table.description)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{table.rows.length} filas</span>
      </div>
      <div className="mt-4 overflow-x-auto rounded-[8px] border border-slate-200">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-[#0E109E] text-xs uppercase text-white">
            {instance.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className="px-3 py-3 font-semibold">
                    <button type="button" className="flex items-center gap-2 text-left" onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span>{header.column.getIsSorted() === 'asc' ? '↑' : header.column.getIsSorted() === 'desc' ? '↓' : ''}</span>
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {instance.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/70">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 text-slate-700">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.rows.length > 8 ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => instance.previousPage()} disabled={!instance.getCanPreviousPage()}>
            Anterior
          </Button>
          <span className="text-xs text-slate-500">
            {instance.getState().pagination.pageIndex + 1} / {instance.getPageCount()}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => instance.nextPage()} disabled={!instance.getCanNextPage()}>
            Siguiente
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function DashboardTables({ result }: { result: DashboardResult }) {
  const tables = result.tables.filter((table) => table.columns.length && table.rows.length);
  if (!tables.length) return null;
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-950">Tablas del dashboard</p>
        <p className="mt-1 text-xs text-slate-600">Tablas resumidas para revisar los principales cortes del analisis.</p>
      </div>
      {tables.map((table) => <DashboardDataTable key={table.title} table={table} />)}
    </section>
  );
}
