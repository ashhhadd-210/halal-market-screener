import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, ListChecks, Search, Sparkles } from "lucide-react";

import type { CryptoExchangeOption } from "@/types/screener";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  availableExchanges: CryptoExchangeOption[];
  exchanges: string[];
  onExchangesChange: (v: string[]) => void;
  loading?: boolean;
}

export function CryptoExchangeFilter({
  availableExchanges,
  exchanges,
  onExchangesChange,
  loading = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedExchanges = Array.from(
    new Set(
      exchanges
        .map((exchange) => String(exchange || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ).sort();
  const exchangeOptions = availableExchanges.length
    ? availableExchanges
    : selectedExchanges.map((exchange) => ({
        exchange,
        coin_count: 0,
      }));
  const exchangeNames = exchangeOptions.map((option) => option.exchange);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? exchangeOptions.filter((option) => option.exchange.includes(normalizedQuery))
    : exchangeOptions;
  const usingAllExchanges = selectedExchanges.length === 0;
  const selectedCount = selectedExchanges.length;
  const visibleCount = filteredOptions.length;

  const toggleExchange = (exchange: string) => {
    const normalized = exchange.toLowerCase();

    if (!exchangeOptions.length) {
      return;
    }

    if (selectedExchanges.includes(normalized)) {
      onExchangesChange(selectedExchanges.filter((value) => value !== normalized));
      return;
    }

    const next = [...selectedExchanges, normalized].sort();
    if (
      exchangeNames.length
      && exchangeNames.every((value) => next.includes(value))
    ) {
      onExchangesChange([]);
      return;
    }

    onExchangesChange(next);
  };

  const summaryLabel = loading
    ? "Loading exchanges..."
    : usingAllExchanges
      ? "All exchanges"
      : selectedExchanges.length === 1
        ? selectedExchanges[0]
        : `${selectedExchanges.length} exchanges`;
  const summaryDetail = loading
    ? "Fetching exchange list from the backend"
    : usingAllExchanges
      ? `${exchangeOptions.length || 0} exchanges active by default`
      : `${selectedCount} of ${exchangeOptions.length || selectedCount} exchanges selected`;

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Crypto Exchange</label>
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSearchQuery("");
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-auto w-full justify-between rounded-2xl border-sidebar-border/70 bg-sidebar-accent/35 px-3 py-3 text-left text-sidebar-foreground hover:bg-sidebar-accent/55"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="rounded-xl border border-sidebar-border/70 bg-background/20 p-2 text-sidebar-foreground/75">
                <ListChecks className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {summaryLabel}
                </span>
                <span className="block text-xs text-sidebar-foreground/55">
                  {loading
                    ? "Fetching exchange list from the backend"
                    : usingAllExchanges
                      ? `${exchangeOptions.length || 0} exchanges available`
                      : `${selectedCount} of ${exchangeOptions.length || selectedCount} exchanges active`}
                </span>
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={10}
          className="w-[min(25rem,calc(100vw-1.5rem))] overflow-hidden rounded-[28px] border-white/10 bg-[linear-gradient(180deg,hsl(var(--popover))_0%,hsl(214_32%_10%)_100%)] p-0 text-popover-foreground shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)_/_0.18),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/55">
                  <Sparkles className="h-3.5 w-3.5" />
                  Crypto Exchanges
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {usingAllExchanges ? "Using the full exchange universe" : "Custom exchange selection"}
                </div>
                <div className="mt-1 text-xs text-white/60">
                  {loading
                    ? "Loading exchange availability"
                    : `${exchangeOptions.length || 0} exchanges in universe`}
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/75">
                {usingAllExchanges ? "Default" : `${selectedCount} selected`}
              </div>
            </div>

            <div className="mt-4" onKeyDown={(event) => event.stopPropagation()}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search exchanges..."
                  className="h-10 rounded-2xl border-white/10 bg-black/20 pl-10 text-sm text-white placeholder:text-white/35 focus-visible:ring-white/20"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                aria-label="Use all exchanges"
                onClick={() => onExchangesChange([])}
                className={cn(
                  "flex-1 rounded-2xl border px-3 py-2 text-left transition-all",
                  usingAllExchanges
                    ? "border-primary/40 bg-primary/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "border-white/10 bg-white/5 text-white/75 hover:border-white/20 hover:bg-white/10",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Globe2 className="h-4 w-4" />
                  All exchanges
                </span>
                <span className="mt-1 block text-xs text-white/55">
                  No specific filters
                </span>
              </button>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  Visible
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {visibleCount}
                </div>
              </div>
            </div>
          </div>

          <div className="p-2">
            <div className="max-h-80 overflow-y-auto pr-1">
              {filteredOptions.length ? (
                <div className="space-y-1">
                  {filteredOptions.map((option) => {
                    const selected = selectedExchanges.includes(option.exchange);
                    return (
                      <button
                        key={option.exchange}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleExchange(option.exchange)}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all",
                          selected
                            ? "border-primary/35 bg-primary/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                            : "border-transparent bg-white/[0.03] text-white/80 hover:border-white/10 hover:bg-white/[0.06]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                            selected
                              ? "border-primary/50 bg-primary/25 text-white"
                              : "border-white/12 bg-black/10 text-transparent group-hover:border-white/20",
                          )}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/75">
                          {option.coin_count.toLocaleString()} coins
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-sm lowercase">
                          {option.exchange}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : exchangeOptions.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/55">
                  No exchanges match "{searchQuery.trim()}".
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/55">
                  {loading
                    ? "Loading exchanges..."
                    : "Exchange list unavailable right now."}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/10 px-4 py-3 text-[11px] text-white/55">
            {usingAllExchanges
              ? `No specific exchange is selected. The screener will use all ${exchangeOptions.length || 0} exchanges.`
              : `${selectedCount} exchange${selectedCount === 1 ? "" : "s"} selected. Remove every selected exchange to fall back to all exchanges.`}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="text-[10px] text-muted-foreground">
        Empty selection means all exchanges. Pick specific exchanges only when you want to narrow the crypto universe.
      </div>
    </div>
  );
}
