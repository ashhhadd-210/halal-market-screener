import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { INDICATOR_CATEGORY_MAP } from "@/types/screener";
import type { ScreenerResult, ScreenerResultDetail, IndicatorCategory } from "@/types/screener";
import { ResultDetailPanel } from "./ResultDetailPanel";
import { getIndicatorColor } from "./indicatorColors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  results: ScreenerResult[];
  loading: boolean;
  activeSignalNames?: string[];
  onRequestDetail: (result: ScreenerResult) => Promise<ScreenerResultDetail>;
}

type SortKey = "symbol" | "price" | "data_source" | "timeframe" | "category";
type SortDir = "asc" | "desc";
type ViewMode = "table" | "compact";

const PAGE_SIZE = 25;
const CATEGORY_PAGE_SIZE = 100;

function formatPrice(value: number): string {
  const abs = Math.abs(value);

  if (abs === 0) {
    return "$0.00";
  }

  if (abs >= 1) {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (abs >= 0.01) {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }

  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })}`;
}

function parsePriceFilterValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPrimaryCategory(stickers: string[]): IndicatorCategory | "mixed" | "uncategorized" {
  const counts = new Map<IndicatorCategory, number>();

  stickers.forEach((sticker) => {
    const lowered = sticker.toLowerCase();
    const match = Object.entries(INDICATOR_CATEGORY_MAP).find(([name]) =>
      lowered.startsWith(name.toLowerCase()),
    );

    if (match) {
      const category = match[1];
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  });

  if (counts.size === 0) return "uncategorized";

  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ordered.length > 1 && ordered[0][1] === ordered[1][1]) return "mixed";
  return ordered[0][0];
}

function getCategoryTone(category: ReturnType<typeof getPrimaryCategory>) {
  switch (category) {
    case "momentum":
      return "border-purple-500/20 bg-purple-500/10 text-purple-300";
    case "trend":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case "volume":
      return "border-orange-500/20 bg-orange-500/10 text-orange-300";
    case "channel":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "confluence":
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    case "mixed":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
    default:
      return "border-border/70 bg-secondary/40 text-muted-foreground";
  }
}

const WATCHLIST_STORAGE_KEY = "screener.watchlist";

export function ResultsTable({ results, loading, activeSignalNames = [], onRequestDetail }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [selectedResult, setSelectedResult] = useState<ScreenerResult | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ScreenerResultDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [comparedSymbols, setComparedSymbols] = useState<string[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryVisibleCount, setCategoryVisibleCount] = useState(CATEGORY_PAGE_SIZE);
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const detailRequestId = useRef(0);
  const categorySearchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(search);
  const deferredCategorySearch = useDeferredValue(categorySearch);
  const activeSignalSet = useMemo(
    () => new Set(activeSignalNames.map((name) => name.toLowerCase())),
    [activeSignalNames],
  );
  const watchlistSet = useMemo(
    () => new Set(watchlist.map((symbol) => symbol.toLowerCase())),
    [watchlist],
  );
  const selectedCategorySet = useMemo(
    () => new Set(selectedCategories.map((value) => value.toLowerCase())),
    [selectedCategories],
  );
  const minPriceValue = useMemo(() => parsePriceFilterValue(minPriceFilter), [minPriceFilter]);
  const maxPriceValue = useMemo(() => parsePriceFilterValue(maxPriceFilter), [maxPriceFilter]);
  const hasPriceFilter = minPriceValue !== null || maxPriceValue !== null;
  const priceRangeInvalid =
    minPriceValue !== null
    && maxPriceValue !== null
    && minPriceValue > maxPriceValue;

  const stickersForRow = useCallback((row: ScreenerResult) => {
    const stickers = row.stickers || [];
    if (activeSignalSet.size === 0) {
      return stickers;
    }

    const matched = row.matched_indicators || [];
    if (!matched.length) {
      return stickers;
    }

    return stickers.filter((_, index) => {
      const indicatorName = String(matched[index] || "").toLowerCase();
      return indicatorName ? activeSignalSet.has(indicatorName) : true;
    });
  }, [activeSignalSet]);

  const categoryLabelForRow = useCallback((row: ScreenerResult) => {
    return row.category || row.compliance_status || row.exchange || "uncategorized";
  }, []);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    results.forEach((row) => {
      const label = categoryLabelForRow(row);
      const key = label.toLowerCase();
      if (!map.has(key)) {
        map.set(key, label);
      }
    });
    return [...map.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoryLabelForRow, results]);

  const filteredCategoryOptions = useMemo(() => {
    const query = deferredCategorySearch.trim().toLowerCase();

    if (!query) {
      return categoryOptions;
    }

    return categoryOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [categoryOptions, deferredCategorySearch]);

  const visibleCategoryOptions = useMemo(
    () => filteredCategoryOptions.slice(0, categoryVisibleCount),
    [categoryVisibleCount, filteredCategoryOptions],
  );

  const remainingCategoryCount = Math.max(0, filteredCategoryOptions.length - categoryVisibleCount);
  const hasMoreCategoryOptions = remainingCategoryCount > 0;

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();

    return results.filter((r) => {
      const visibleStickers = stickersForRow(r);
      const categoryLabel = categoryLabelForRow(r).toLowerCase();

      const matchesSearch = !q || [
        r.symbol.toLowerCase(),
        r.data_source.toLowerCase(),
        categoryLabel,
        ...visibleStickers.map((s) => s.toLowerCase()),
      ].some((value) => value.includes(q));

      const includedByCategory = selectedCategorySet.size === 0 || selectedCategorySet.has(categoryLabel);
      const matchesWatchlist = !watchlistOnly || watchlistSet.has(r.symbol.toLowerCase());
      const matchesPrice =
        priceRangeInvalid
          ? true
          : (minPriceValue === null || r.price >= minPriceValue)
            && (maxPriceValue === null || r.price <= maxPriceValue);

      return matchesSearch && includedByCategory && matchesWatchlist && matchesPrice;
    });
  }, [categoryLabelForRow, deferredSearch, maxPriceValue, minPriceValue, priceRangeInvalid, results, selectedCategorySet, stickersForRow, watchlistOnly, watchlistSet]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = sortKey === "category" ? categoryLabelForRow(a) : a[sortKey];
      const bVal = sortKey === "category" ? categoryLabelForRow(b) : b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortDir === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  }, [categoryLabelForRow, filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const comparedRows = useMemo(
    () => sorted.filter((row) => comparedSymbols.includes(row.symbol)),
    [comparedSymbols, sorted],
  );

  useEffect(() => {
    setSelectedResult(null);
    setSelectedDetail(null);
    setDetailError("");
    setDetailLoading(false);
  }, [results]);

  useEffect(() => {
    setCategoryVisibleCount(CATEGORY_PAGE_SIZE);
  }, [deferredCategorySearch, categoryFilterOpen, categoryOptions.length]);

  useEffect(() => {
    if (!categoryFilterOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      categorySearchInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [categoryFilterOpen]);

  const closeDetail = () => {
    setSelectedResult(null);
    setSelectedDetail(null);
    setDetailError("");
    setDetailLoading(false);
  };

  const openDetail = async (row: ScreenerResult) => {
    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;

    setSelectedResult(row);
    setSelectedDetail(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const detail = await onRequestDetail(row);
      if (detailRequestId.current !== requestId) {
        return;
      }
      setSelectedDetail(detail);
    } catch (error) {
      if (detailRequestId.current !== requestId) {
        return;
      }
      setDetailError(error instanceof Error ? error.message : "Unable to load asset details.");
    } finally {
      if (detailRequestId.current === requestId) {
        setDetailLoading(false);
      }
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleCompared = (symbol: string) => {
    setComparedSymbols((current) => {
      if (current.includes(symbol)) {
        return current.filter((item) => item !== symbol);
      }

      return [...current.slice(-1), symbol];
    });
  };

  const toggleWatchlist = (symbol: string) => {
    setWatchlist((current) => {
      const next = current.includes(symbol)
        ? current.filter((item) => item !== symbol)
        : [...current, symbol];
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearSelectedCategories = () => {
    setSelectedCategories([]);
    setPage(0);
  };

  const toggleSelectedCategory = (optionKey: string, optionLabel: string) => {
    setSelectedCategories((current) => {
      const next = current.some((item) => item.toLowerCase() === optionKey)
        ? current.filter((item) => item.toLowerCase() !== optionKey)
        : [...current, optionLabel];

      return next;
    });
    setPage(0);
  };

  const handleCategoryFilterOpenChange = (open: boolean) => {
    setCategoryFilterOpen(open);
    setCategoryVisibleCount(CATEGORY_PAGE_SIZE);

    if (!open) {
      setCategorySearch("");
    }
  };

  const downloadExcel = () => {
    const headers = ["Symbol", "Price", "Source", "Timeframe", "Category", "Signal Mix", "Indicators", "Note"];
    const rows = sorted.map((row) => [
      row.symbol,
      row.price,
      row.data_source,
      row.timeframe,
      categoryLabelForRow(row),
      getPrimaryCategory(stickersForRow(row)),
      stickersForRow(row).join(", "),
      row.note ?? "",
    ]);

    const worksheet = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([worksheet], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "screener-results.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const priceFilterSummary = () => {
    if (!hasPriceFilter) {
      return " (Any)";
    }

    if (priceRangeInvalid) {
      return " (Fix range)";
    }

    if (minPriceValue !== null && maxPriceValue !== null) {
      return ` (${formatPrice(minPriceValue)} - ${formatPrice(maxPriceValue)})`;
    }

    if (minPriceValue !== null) {
      return ` (>= ${formatPrice(minPriceValue)})`;
    }

    return ` (<= ${formatPrice(maxPriceValue as number)})`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[24px] border border-border/70 bg-card/60 p-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-mono">Scanning markets...</span>
        </div>
      </div>
    );
  }

  const columns: [SortKey, string][] = [
    ["symbol", "Symbol"],
    ["price", "Price"],
    ["data_source", "Source"],
    ["timeframe", "Timeframe"],
    ["category", "Category"],
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {selectedResult && (
        <ResultDetailPanel
          result={selectedResult}
          detail={selectedDetail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      )}

      <div className="rounded-[28px] border border-border/70 bg-card/55 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-[260px] flex-1 items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search symbols, sources, indicators..."
                className="w-full rounded-2xl border border-border/70 bg-secondary/65 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {(["table", "compact"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-2xl border px-3 py-2 text-xs uppercase tracking-[0.18em] transition-colors ${
                    viewMode === mode
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/70 bg-secondary/35 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWatchlistOnly((current) => !current)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                watchlistOnly
                  ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                  : "border-border/70 bg-secondary/35 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className="h-3.5 w-3.5" />
              Watchlist
            </button>
            <span className="rounded-full border border-border/70 bg-secondary/60 px-3 py-1.5 text-xs font-mono text-muted-foreground">
              {filtered.length} results
            </span>
            <button
              onClick={downloadExcel}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <Download className="h-3.5 w-3.5" />
              Download Excel
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Popover open={categoryFilterOpen} onOpenChange={handleCategoryFilterOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="rounded-2xl border border-border/70 bg-secondary/65 px-4 py-2 text-xs text-foreground transition-colors hover:border-primary/40"
              >
                Categories
                {selectedCategories.length > 0 ? ` (${selectedCategories.length})` : " (All)"}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={8}
              collisionPadding={16}
              onOpenAutoFocus={(event) => event.preventDefault()}
              onWheelCapture={(event) => event.stopPropagation()}
              className="w-64 rounded-2xl border border-border/70 bg-card/95 p-2 shadow-[0_12px_40px_hsl(210_45%_3%_/_0.22)] backdrop-blur"
            >
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={categorySearchInputRef}
                  type="text"
                  aria-label="Search categories"
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Search categories..."
                  className="w-full rounded-xl border border-border/60 bg-secondary/40 py-2 pl-9 pr-3 text-xs text-foreground outline-none transition-colors focus:border-primary/50"
                />
              </div>
              <ScrollArea
                type="always"
                scrollbarForceMount
                className="max-h-72 overscroll-contain"
                scrollbarClassName="w-3 rounded-full bg-border/20 p-[2px]"
                thumbClassName="bg-border/80"
              >
                <div className="space-y-1 pb-3 pr-3">
                  <button
                    type="button"
                    onClick={clearSelectedCategories}
                    className="w-full rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/50"
                  >
                    All categories
                  </button>
                  {filteredCategoryOptions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      {deferredCategorySearch.trim() ? "No categories match that search." : "No categories yet."}
                    </div>
                  )}
                  {visibleCategoryOptions.map((option) => {
                    const selected = selectedCategorySet.has(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleSelectedCategory(option.key, option.label)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                          selected
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/60 bg-secondary/30 text-foreground hover:border-primary/40"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                  {hasMoreCategoryOptions && (
                    <button
                      type="button"
                      onClick={() => setCategoryVisibleCount((current) => current + CATEGORY_PAGE_SIZE)}
                      className="w-full rounded-xl border border-dashed border-border/60 bg-secondary/20 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      Show {Math.min(CATEGORY_PAGE_SIZE, remainingCategoryCount)} more
                    </button>
                  )}
                </div>
              </ScrollArea>
              <div className="mt-2 px-1 text-[10px] text-muted-foreground">
                Showing {visibleCategoryOptions.length} of {filteredCategoryOptions.length} categories
              </div>
            </PopoverContent>
          </Popover>

          <details className="relative">
            <summary className="cursor-pointer list-none rounded-2xl border border-border/70 bg-secondary/65 px-4 py-2 text-xs text-foreground transition-colors hover:border-primary/40">
              Price
              {priceFilterSummary()}
            </summary>
            <div className="absolute left-0 z-20 mt-2 w-72 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-[0_12px_40px_hsl(210_45%_3%_/_0.22)] backdrop-blur">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Minimum</div>
                  <input
                    aria-label="Minimum price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={minPriceFilter}
                    onChange={(event) => {
                      setMinPriceFilter(event.target.value);
                      setPage(0);
                    }}
                    className="w-full rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-xs text-foreground outline-none transition-colors focus:border-primary/50"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Maximum</div>
                  <input
                    aria-label="Maximum price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={maxPriceFilter}
                    onChange={(event) => {
                      setMaxPriceFilter(event.target.value);
                      setPage(0);
                    }}
                    className="w-full rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-xs text-foreground outline-none transition-colors focus:border-primary/50"
                    placeholder="No cap"
                  />
                </div>
              </div>

              <div className={`mt-2 text-[10px] ${priceRangeInvalid ? "text-destructive" : "text-muted-foreground"}`}>
                {priceRangeInvalid
                  ? "Minimum price must be less than or equal to maximum price."
                  : hasPriceFilter
                    ? "Results update instantly as you narrow the range."
                    : "Leave either field empty to keep that side open."}
              </div>

              <button
                onClick={() => {
                  setMinPriceFilter("");
                  setMaxPriceFilter("");
                  setPage(0);
                }}
                className="mt-3 w-full rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/50"
              >
                Any price
              </button>
            </div>
          </details>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 md:hidden">
          <div className="flex gap-2">
            {(["table", "compact"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-2xl border px-3 py-2 text-xs uppercase tracking-[0.18em] transition-colors ${
                  viewMode === mode
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/70 bg-secondary/35 text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {currentPage + 1}/{totalPages}
          </span>
        </div>
      </div>

      {comparedRows.length > 0 && (
        <div className="rounded-[24px] border border-border/70 bg-card/45 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Compare
            </span>
            {comparedRows.map((row) => (
              <button
                key={`compare-${row.symbol}`}
                onClick={() => void openDetail(row)}
                className="rounded-full border border-border/70 bg-background/30 px-3 py-1.5 text-xs text-foreground"
              >
                {row.symbol} · {formatPrice(row.price)} · {stickersForRow(row).length} signals
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-dashed border-border/70 bg-card/55 p-12">
          <div className="space-y-2 text-center">
            <div className="text-sm font-semibold text-foreground">No results yet</div>
            <p className="text-sm text-muted-foreground">Adjust the filters or rerun the scan to surface matching assets.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-hidden rounded-[30px] border border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)_/_0.92),hsl(210_24%_10%_/_0.92))] shadow-[0_20px_70px_hsl(210_45%_3%_/_0.24)]">
            <div className="h-full overflow-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-secondary/35 backdrop-blur">
                  <tr className="border-b border-border/70">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Watch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Compare
                    </th>
                    {columns
                      .filter(([key]) => viewMode === "table" || !["data_source", "timeframe"].includes(key))
                      .map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        className={`px-4 py-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground cursor-pointer select-none transition-colors hover:text-foreground ${
                          key === "price" ? "text-right" : "text-left"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          <SortIcon col={key} />
                        </span>
                      </th>
                    ))}
                    {viewMode === "table" && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Signal Mix
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Indicators
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => {
                    const visibleStickers = stickersForRow(row);
                    const rowCategory = categoryLabelForRow(row);
                    return (
                      <tr
                        key={`${row.symbol}-${row.data_source}-${row.timeframe}`}
                        onClick={() => void openDetail(row)}
                        className="group cursor-pointer border-b border-border/50 transition-colors hover:bg-secondary/20"
                      >
                      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                        <button
                          onClick={() => toggleWatchlist(row.symbol)}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                            watchlistSet.has(row.symbol.toLowerCase())
                              ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                              : "border-border/70 bg-background/30 text-muted-foreground hover:text-foreground"
                          }`}
                          aria-label={`Watch ${row.symbol}`}
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                        <button
                          onClick={() => toggleCompared(row.symbol)}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                            comparedSymbols.includes(row.symbol)
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border/70 bg-background/30 text-muted-foreground hover:text-foreground"
                          }`}
                          aria-label={`Compare ${row.symbol}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-background/30 font-mono text-xs font-semibold text-primary">
                            {row.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-mono font-semibold text-foreground">{row.symbol}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.name || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-foreground">{formatPrice(row.price)}</td>
                      {viewMode === "table" && (
                        <td className="px-4 py-3 text-secondary-foreground capitalize">
                        {row.data_source}
                        {row.exchange ? ` • ${row.exchange}` : ""}
                        {!!row.exchange_availability?.length && (
                          <span className="block text-[10px] lowercase text-muted-foreground">
                            {row.exchange_availability.slice(0, 5).join(", ")}
                          </span>
                        )}
                        </td>
                      )}
                      {viewMode === "table" && (
                        <td className="px-4 py-3 font-mono text-secondary-foreground">{row.timeframe}</td>
                      )}
                      <td className="px-4 py-3 text-secondary-foreground">{rowCategory}</td>
                      {viewMode === "table" && (
                        <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${getCategoryTone(getPrimaryCategory(visibleStickers))}`}>
                          {getPrimaryCategory(visibleStickers)}
                        </span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className={`flex gap-1.5 flex-wrap ${viewMode === "compact" ? "max-w-[320px]" : ""}`}>
                          {(viewMode === "compact" ? visibleStickers.slice(0, 3) : visibleStickers).map((s, i) => {
                            const color = getIndicatorColor(s);
                            return (
                              <span
                                key={`${row.symbol}-${s}-${i}`}
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${color.bg} ${color.text} ${color.border}`}
                              >
                                {s}
                              </span>
                            );
                          })}
                          {viewMode === "compact" && visibleStickers.length > 3 && (
                            <span className="rounded-full border border-border/70 bg-secondary/35 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                              +{visibleStickers.length - 3} more
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                            Details
                            <ArrowUpRight className="h-3 w-3" />
                          </span>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-[24px] border border-border/70 bg-card/45 px-4 py-3">
              <span className="text-xs font-mono text-muted-foreground">
                Page {currentPage + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
