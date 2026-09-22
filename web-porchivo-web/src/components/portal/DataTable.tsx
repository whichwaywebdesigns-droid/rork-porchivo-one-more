import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Search,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column non-sortable. */
  sortValue?: (row: T) => string | number;
  /** Plain-text value matched by the global search box. */
  searchValue?: (row: T) => string;
  cellClassName?: string;
  headerClassName?: string;
}

export interface DataTableFilter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  predicate: (row: T, value: string) => boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  filters?: DataTableFilter<T>[];
  searchPlaceholder?: string;
  initialPageSize?: number;
  initialSort?: { key: string; direction: "asc" | "desc" };
  emptyIcon?: LucideIcon;
  /**
   * Optional mobile renderer — when provided, the wide table is shown from `md`
   * up and this renders stacked cards below `md` (existing mobile look).
   */
  renderMobileRow?: (row: T) => ReactNode;
}

const ALL = "__all__";

/**
 * Shared portal table system: live search, per-column filters, click-to-sort
 * headers (mouse + keyboard, with aria-sort), pagination, and friendly empty
 * states. One component so every portal page feels identical on desktop.
 */
export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  filters = [],
  searchPlaceholder,
  initialPageSize = 15,
  initialSort,
  emptyIcon: EmptyIcon = Inbox,
  renderMobileRow,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [query, setQuery] = useState<string>("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(
    initialSort ?? null,
  );
  const [page, setPage] = useState<number>(1);

  const pageSize = initialPageSize;

  // Reset to the first page whenever the result set changes shape.
  useEffect(() => {
    setPage(1);
  }, [query, filterValues]);

  const filtered = useMemo(() => {
    let result = rows;
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((row) =>
        columns.some((column) => {
          const text = column.searchValue ? column.searchValue(row) : null;
          return text !== null && text.toLowerCase().includes(q);
        }),
      );
    }
    for (const filter of filters) {
      const value = filterValues[filter.key];
      if (value && value !== ALL) {
        result = result.filter((row) => filter.predicate(row, value));
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, query, filters, filterValues]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return filtered;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string): void => {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const hasControls = Boolean(query) || filters.length > 0;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2.5 mb-4">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder ?? t("portal.table.search")}
          aria-label={searchPlaceholder ?? t("portal.table.search")}
          className="pl-8 h-9 bg-white/85 dark:bg-brand-navy-800/60"
        />
      </div>
      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={filterValues[filter.key] ?? ALL}
          onValueChange={(value) =>
            setFilterValues((current) => ({ ...current, [filter.key]: value }))
          }
        >
          <SelectTrigger
            className="w-auto min-w-[130px] h-9 bg-white/85 dark:bg-brand-navy-800/60"
            aria-label={filter.label}
          >
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("portal.table.filterAll")}</SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {hasControls && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-brand-text-muted"
          onClick={() => {
            setQuery("");
            setFilterValues({});
          }}
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          {t("portal.table.clearSearch")}
        </Button>
      )}
      <span className="ml-auto text-[12px] text-brand-text-muted tabular-nums">
        {sorted.length}
      </span>
    </div>
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-navy-900/5 dark:bg-brand-navy-500/20 mb-3">
        <EmptyIcon className="w-6 h-6 text-brand-text-muted" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-brand-text-primary">{t("portal.table.emptyTitle")}</p>
      <p className="mt-1 text-[13px] text-brand-text-muted max-w-xs leading-relaxed">
        {t("portal.table.emptyBody")}
      </p>
    </div>
  );

  const pagination =
    totalPages > 1 ? (
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[12px] text-brand-text-muted tabular-nums" aria-live="polite">
          {t("portal.table.pageOf", { current: safePage, total: totalPages })}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            aria-label={t("portal.table.prevPage")}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            aria-label={t("portal.table.nextPage")}
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    ) : null;

  if (sorted.length === 0 && !hasControls) {
    return <div>{emptyState}</div>;
  }

  const table = (
    <div className="rounded-xl border border-brand-navy-500/30 bg-white/85 dark:bg-brand-navy-800/60 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-navy-900/5 dark:bg-brand-navy-900/40 hover:bg-brand-navy-900/5">
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                const sortable = Boolean(column.sortValue);
                return (
                  <TableHead
                    key={column.key}
                    aria-sort={
                      isSorted
                        ? sort!.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : sortable
                          ? "none"
                          : undefined
                    }
                    className={`whitespace-nowrap ${column.headerClassName ?? ""}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        aria-label={t("portal.table.sortBy", { column: column.header })}
                        className="inline-flex items-center gap-1 font-semibold text-brand-text-primary hover:text-brand-text-secondary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-light rounded"
                      >
                        {column.header}
                        {isSorted ? (
                          sort!.direction === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown
                            className="w-3.5 h-3.5 text-brand-text-muted"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={getRowKey(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={`align-middle ${column.cellClassName ?? ""}`}
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {sorted.length === 0 && <div>{emptyState}</div>}
    </div>
  );

  return (
    <div>
      {toolbar}
      {renderMobileRow ? (
        <>
          <div className="hidden md:block">{table}</div>
          <div className="md:hidden space-y-3">
            {pageRows.map((row) => (
              <div key={getRowKey(row)}>{renderMobileRow(row)}</div>
            ))}
            {sorted.length === 0 && emptyState}
          </div>
        </>
      ) : (
        table
      )}
      {pagination}
    </div>
  );
}
