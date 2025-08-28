import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  getPaginationRowModel,
  RowSelectionState,
  getFilteredRowModel,
  PaginationState,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ReusableTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  className?: string;
  onRowClick?: (row: TData) => void;
  enableSorting?: boolean;
  showPagination?: boolean;
  pageSize?: number;
  rightAlignedColumns?: string[];
  searchButtons?: React.ReactNode;
  loading?: boolean;
  onSelectionChange?: (selectedRows: TData[]) => void;
  selectionActions?: React.ReactNode;
  // Server-side pagination props
  serverSidePagination?: boolean;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  // Search props
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
}

export function ReusableTable<TData>({
  columns,
  data,
  className,
  onRowClick,
  enableSorting = true,
  showPagination = true,
  pageSize = 10,
  rightAlignedColumns = [],
  searchButtons,
  loading = false,
  onSelectionChange,
  selectionActions,
  // Server-side pagination props
  serverSidePagination = false,
  totalCount,
  onPageChange,
  currentPage = 1,
  // Search props
  globalFilter: externalGlobalFilter,
  onGlobalFilterChange,
}: ReusableTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: currentPage - 1,
    pageSize,
  });

  // Use external global filter if provided, otherwise use internal state
  const effectiveGlobalFilter =
    externalGlobalFilter !== undefined ? externalGlobalFilter : globalFilter;
  const handleGlobalFilterChange = onGlobalFilterChange || setGlobalFilter;

  const shouldEnableRowSelection = Boolean(
    onSelectionChange || selectionActions
  );

  const table = useReactTable({
    data,
    columns: shouldEnableRowSelection
      ? [
          {
            id: 'select',
            header: ({ table }) => (
              <Label htmlFor="select-all" className="flex gap-2 items-center cursor-pointer max-w-fit">
                <Checkbox
                  id="select-all"
                  className="cursor-pointer"
                  checked={
                    table.getIsAllRowsSelected() ||
                    (table.getIsSomeRowsSelected() && 'indeterminate')
                  }
                  onCheckedChange={(checked) => {
                    table.toggleAllRowsSelected(!!checked);
                  }}
                  aria-label="Select all"
                />
                <span className="text-sm">Select All</span>
              </Label>
            ),
            cell: ({ row }) => (
              <Checkbox
                className="cursor-pointer"
                checked={row.getIsSelected()}
                onCheckedChange={(checked) => {
                  row.toggleSelected(!!checked);
                }}
                aria-label="Select row"
                onClick={(e) => e.stopPropagation()}
              />
            ),
            enableSorting: false,
            enableHiding: false,
          },
          ...columns,
        ]
      : columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: serverSidePagination
      ? undefined
      : getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: handleGlobalFilterChange,
    onPaginationChange: setPagination,
    state: {
      sorting,
      rowSelection,
      globalFilter: effectiveGlobalFilter,
      pagination: serverSidePagination
        ? {
            pageIndex: currentPage - 1,
            pageSize,
          }
        : pagination,
    },
    enableRowSelection: shouldEnableRowSelection,
    enableSorting,
    manualPagination: serverSidePagination,
    pageCount: serverSidePagination
      ? Math.ceil((totalCount || 0) / pageSize)
      : undefined,
  });

  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table
        .getSelectedRowModel()
        .rows.map((row) => row.original);
      onSelectionChange(selectedRows);
    }
  }, [rowSelection, onSelectionChange, table]);

  React.useEffect(() => {
    if (serverSidePagination && onPageChange) {
      onPageChange(pagination.pageIndex + 1);
    }
  }, [pagination.pageIndex, serverSidePagination, onPageChange]);

  return (
    <div className={className}>
      {searchButtons && (
        <div className="flex justify-between items-center pb-4">
          <Input
            placeholder="Search..."
            value={effectiveGlobalFilter ?? ''}
            onChange={(event) => handleGlobalFilterChange(event.target.value)}
            className="max-w-sm"
          />
          {searchButtons && (
            <div className="flex gap-2 items-center">{searchButtons}</div>
          )}
        </div>
      )}
      {shouldEnableRowSelection &&
        selectionActions &&
        table.getSelectedRowModel().rows.length > 0 && (
          <div className="flex justify-between items-center pb-2">
            <div className="text-sm text-muted-foreground">
              {table.getSelectedRowModel().rows.length} row(s) selected
            </div>
            <div className="flex gap-2 items-center">{selectionActions}</div>
          </div>
        )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isRightAligned = rightAlignedColumns.includes(header.id);
                return (
                  <TableHead
                    key={header.id}
                    className={isRightAligned ? 'text-right' : ''}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            // Show skeleton loading rows
            Array.from({ length: pageSize }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                {columns.map((_, colIndex) => {
                  const isRightAligned = rightAlignedColumns.includes(
                    columns[colIndex].id as string
                  );
                  return (
                    <TableCell
                      key={`skeleton-cell-${colIndex}`}
                      className={isRightAligned ? 'text-right' : ''}
                    >
                      <Skeleton className="h-4 w-[80%]" />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                onClick={() => onRowClick?.(row.original)}
                className={onRowClick ? 'cursor-pointer' : ''}
              >
                {row.getVisibleCells().map((cell) => {
                  const isRightAligned = rightAlignedColumns.includes(
                    cell.column.id
                  );
                  return (
                    <TableCell
                      key={cell.id}
                      className={isRightAligned ? 'text-right' : ''}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {shouldEnableRowSelection &&
        selectionActions &&
        table.getSelectedRowModel().rows.length > 0 && (
          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-muted-foreground">
              {table.getSelectedRowModel().rows.length} row(s) selected
            </div>
            <div className="flex gap-2 items-center">{selectionActions}</div>
          </div>
        )}
      {showPagination && (
        <div className="flex justify-end items-center py-4 space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="px-3 py-1 rounded border"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage() || loading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="px-3 py-1 rounded border"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage() || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
