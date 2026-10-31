import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell?: (row: T) => ReactNode | undefined;
  /** Value used for sorting / CSV export; defaults to row[key] */
  value?: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center" | undefined;
  className?: string | undefined;
  sortable?: boolean | undefined;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void | undefined;
  searchKeys?: ((row: T) => string | null | undefined)[] | undefined;
  searchPlaceholder?: string | undefined;
  pageSize?: number | undefined;
  exportName?: string | undefined;
  toolbar?: ReactNode | undefined;
  initialSort?: { key: string | undefined; dir: "asc" | "desc" };
  empty?: string | undefined;
  dense?: boolean | undefined;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  searchKeys,
  searchPlaceholder = "Search…",
  pageSize = 15,
  exportName,
  toolbar,
  initialSort,
  empty = "No records match the current filters.",
  dense,
}: DataTableProps<T>) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  const getVal = (row: T, col: Column<T>) =>
    col.value ? col.value(row) : ((row as Record<string, unknown>)[col.key] as string | number | null | undefined);

  const filtered = useMemo(() => {
    let out = rows;
    if (q && searchKeys?.length) {
      const needle = q.toLowerCase();
      out = out.filter((r) => searchKeys.some((k) => (k(r) ?? "").toLowerCase().includes(needle)));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        out = [...out].sort((a, b) => {
          const av = getVal(a, col);
          const bv = getVal(b, col);
          if (av == null) return 1;
          if (bv == null) return -1;
          const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  const exportCsv = () =>
    downloadCsv(
      `${exportName}.csv`,
      filtered.map((r) => Object.fromEntries(columns.map((c) => [c.header, getVal(r, c)]))),
    );

  return (
    <div className="panel overflow-hidden">
      {(searchKeys || exportName || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {searchKeys && (
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="h-8 pl-8"
              />
            </div>
          )}
          <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          <span className="num text-xs text-muted-foreground">{filtered.length.toLocaleString()} rows</span>
          {exportName && (
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download /> Export CSV
            </Button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/60">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "eyebrow whitespace-nowrap px-3 py-2 font-medium",
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                    c.sortable !== false && "cursor-pointer select-none hover:text-foreground",
                  )}
                  onClick={c.sortable !== false ? () => toggleSort(c.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn("border-b border-border/60 last:border-0", onRowClick && "cursor-pointer hover:bg-accent/50")}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      dense ? "px-3 py-1.5" : "px-3 py-2.5",
                      c.align === "right" ? "num text-right" : c.align === "center" ? "text-center" : "text-left",
                      c.className,
                    )}
                  >
                    {c.cell ? c.cell(r) : String(getVal(r, c) ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="num">
            Page {current + 1} of {pages}
          </span>
          <Button variant="ghost" size="icon" className="size-7" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
