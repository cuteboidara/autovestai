import { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { EmptyState } from './empty-state';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyTitle = 'No rows',
  emptyDescription = 'No records are available for this view yet.',
  emptyAction,
  emptyIcon,
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        icon={emptyIcon}
      />
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="min-w-max border-separate border-spacing-0 px-4 text-left text-[12px] sm:min-w-full sm:table-fixed sm:px-0 sm:text-[13px]">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'max-w-[160px] overflow-hidden border-b border-border pb-3 pr-4 text-ellipsis font-semibold uppercase tracking-[0.12em] text-muted whitespace-nowrap sm:max-w-[200px]',
                  column.align === 'right' ? 'text-right' : '',
                  column.align === 'center' ? 'text-center' : '',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-border/60 text-secondary transition',
                onRowClick ? 'cursor-pointer hover:bg-page/80' : 'hover:bg-page/40',
                rowClassName?.(row),
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'max-w-[160px] overflow-hidden border-b border-border/60 py-3.5 pr-4 align-middle text-ellipsis whitespace-nowrap sm:max-w-[200px]',
                    column.align === 'right' ? 'text-right' : '',
                    column.align === 'center' ? 'text-center' : '',
                    column.className,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
