import React, { useState, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyTitle = 'No data available',
  emptyDescription = 'There are no records matching your criteria.',
  onRowClick,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleHeaderClick = (column: Column<T>) => {
    if (!column.sortable) return;
    if (sortKey === column.key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(column.key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const recA = a as unknown as Record<string, unknown>;
      const recB = b as unknown as Record<string, unknown>;
      const valA = recA[sortKey];
      const valB = recB[sortKey];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return sortDirection === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [data, sortKey, sortDirection]);

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className="my-2"
      />
    );
  }

  return (
    <div className={cn('overflow-x-auto border border-gogreen-border rounded', className)}>
      <table className="w-full text-left border-collapse text-xs font-mono">
        <thead>
          <tr className="bg-gogreen-bg-secondary/70 border-b border-gogreen-border text-gogreen-text-secondary select-none">
            {columns.map((column) => (
              <th
                key={column.key}
                style={{ width: column.width }}
                className={cn(
                  'px-3.5 py-2.5 font-medium tracking-wider uppercase text-[11px]',
                  column.sortable && 'cursor-pointer hover:text-gogreen-primary transition-colors',
                  column.align === 'right' && 'text-right',
                  column.align === 'center' && 'text-center'
                )}
                onClick={() => handleHeaderClick(column)}
              >
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5',
                    column.align === 'right' && 'justify-end',
                    column.align === 'center' && 'justify-center'
                  )}
                >
                  <span>{column.header}</span>
                  {column.sortable && (
                    <span className="flex flex-col text-[10px] text-gogreen-text-secondary/50">
                      {sortKey === column.key ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="w-3 h-3 text-gogreen-bright" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-gogreen-bright" />
                        )
                      ) : (
                        <div className="w-3 h-3 opacity-30 flex flex-col justify-center items-center">
                          <span className="text-[9px]">↕</span>
                        </div>
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gogreen-border/40">
          {sortedData.map((item) => {
            const rec = item as unknown as Record<string, unknown>;
            return (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick && onRowClick(item)}
                className={cn(
                  'hover:bg-gogreen-bg-elevated/60 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3.5 py-2 text-gogreen-text-primary whitespace-nowrap',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center'
                    )}
                  >
                    {col.render ? col.render(item) : String(rec[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
