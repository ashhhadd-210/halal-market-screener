import { X } from "lucide-react";
import type { FilterDetail, IndicatorDetail, ScreenerResult, ScreenerResultDetail } from "@/types/screener";
import { getIndicatorColor } from "./indicatorColors";

interface Props {
  result: ScreenerResult;
  detail?: ScreenerResultDetail | null;
  loading?: boolean;
  error?: string;
  onClose: () => void;
}

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

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return value.toLocaleString();
}

function formatUnixSeconds(value: number | null | undefined): string {
  if (!value && value !== 0) {
    return "N/A";
  }

  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString();
}

function formatDateValue(value: unknown): string {
  if (!value) {
    return "N/A";
  }

  if (typeof value === "number") {
    return formatUnixSeconds(value);
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function jsonString(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function JsonBlock({ title, value, defaultOpen = false }: { title: string; value: unknown; defaultOpen?: boolean }) {
  const empty =
    value === null
    || value === undefined
    || (typeof value === "object" && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0)
    || (Array.isArray(value) && value.length === 0);

  if (empty) {
    return null;
  }

  return (
    <details
      open={defaultOpen}
      className="rounded-2xl border border-border/60 bg-background/25 p-4"
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
        {title}
      </summary>
      <pre className="mt-3 max-h-72 overflow-auto rounded-2xl border border-border/50 bg-secondary/35 p-3 text-xs leading-5 text-muted-foreground">
        {jsonString(value)}
      </pre>
    </details>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-2xl border border-border/60 bg-background/35 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

function SignalBadge({ label }: { label: string }) {
  const color = getIndicatorColor(label);
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${color.bg} ${color.text} ${color.border}`}>
      {label}
    </span>
  );
}

function DetailStatusBadge({ passed }: { passed: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
        passed
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-rose-400/30 bg-rose-400/10 text-rose-200"
      }`}
    >
      {passed ? "Pass" : "Fail"}
    </span>
  );
}

function IndicatorCard({ item }: { item: IndicatorDetail }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold capitalize text-foreground">{item.name.replace(/_/g, " ")}</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {item.timeframe_scope || "selected scope"}
          </div>
        </div>
        <DetailStatusBadge passed={item.passed} />
      </div>

      {item.sticker && (
        <div className="mt-3">
          <SignalBadge label={item.sticker} />
        </div>
      )}

      <JsonBlock title="Indicator Config" value={item.config} />
    </div>
  );
}

function FilterCard({ item }: { item: FilterDetail }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold capitalize text-foreground">{item.name.replace(/_/g, " ")}</div>
          <div className="text-xs text-muted-foreground">{item.summary || "No summary available."}</div>
        </div>
        <DetailStatusBadge passed={item.passed} />
      </div>

      {item.sticker && (
        <div className="mt-3">
          <SignalBadge label={item.sticker} />
        </div>
      )}

      <JsonBlock title="Filter Details" value={item.details} />
    </div>
  );
}

export function ResultDetailPanel({ result, detail, loading = false, error = "", onClose }: Props) {
  const active = detail ?? result;
  const lastCandle = formatUnixSeconds(active.last_candle_time ?? null);
  const reportDate = formatDateValue(active.report_date);
  const stageLabel = (active.scan_stage || "single").toUpperCase();
  const marketData = detail?.market_data;
  const indicatorDetails = detail?.indicator_details || [];
  const filterDetails = detail?.filter_details || [];

  return (
    <div className="space-y-5 rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--card)_/_0.98),hsl(205_34%_12%_/_0.88))] p-5 shadow-[0_24px_80px_hsl(210_45%_3%_/_0.24)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Selected Asset</div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold font-mono text-foreground">{active.symbol}</h3>
            <span className="rounded-full border border-border/70 bg-background/35 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {active.asset_type}
            </span>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">
              {stageLabel}
            </span>
            <span className="rounded-full border border-border/70 bg-background/35 px-2.5 py-1 text-[10px] font-mono text-foreground">
              {active.timeframe}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">{active.name || "Unnamed asset"}</div>
        </div>
        <button onClick={onClose} className="rounded-full border border-border/70 p-2 text-muted-foreground transition-colors hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetaCard label="Price" value={formatPrice(active.price)} />
        <MetaCard
          label="Source"
          value={`${active.data_source}${active.exchange ? ` • ${active.exchange}` : ""}`}
        />
        <MetaCard
          label="Category / Compliance"
          value={active.category || active.compliance_status || "N/A"}
        />
        <MetaCard label="Last Candle" value={lastCandle} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetaCard label="Candles" value={String(active.candles_count ?? "N/A")} />
        <MetaCard label="CMC ID / Rank" value={`${active.cmc_id ?? "N/A"} / ${active.rank ?? "N/A"}`} />
        <MetaCard label="Report Date" value={reportDate} />
        <MetaCard label="Purification Ratio" value={active.purification_ratio?.toString() || "N/A"} />
      </div>

      {active.exchange_availability?.length ? (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Exchange Availability</div>
          <div className="flex flex-wrap gap-1.5">
            {active.exchange_availability.map((exchange) => (
              <span key={exchange} className="rounded-full border border-border/70 bg-background/30 px-2.5 py-1 text-xs text-foreground">
                {exchange}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Matched Signals</div>
        <div className="flex flex-wrap gap-1.5">
          {active.stickers.length > 0 ? (
            active.stickers.map((sticker, index) => (
              <SignalBadge key={`${active.symbol}-${sticker}-${index}`} label={sticker} />
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No matched signals on the current detail payload.</span>
          )}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          Loading backend detail for this asset...
        </div>
      )}

      {!!error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {detail && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetaCard label="Candle Provider" value={marketData?.candles_provider || "N/A"} />
            <MetaCard label="Next Refresh" value={formatUnixSeconds(marketData?.next_refresh_at)} />
            <MetaCard
              label="Shares / Float"
              value={`${formatNumber(marketData?.shares_outstanding)} / ${formatNumber(marketData?.float_shares)}`}
            />
          </div>

          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Indicator Diagnostics</div>
            {indicatorDetails.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {indicatorDetails.map((item) => (
                  <IndicatorCard key={`${item.name}-${item.timeframe_scope}`} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-background/25 px-4 py-3 text-sm text-muted-foreground">
                No indicator filters were active for this scan.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Filter Diagnostics</div>
            {filterDetails.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {filterDetails.map((item) => (
                  <FilterCard key={item.name} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-background/25 px-4 py-3 text-sm text-muted-foreground">
                No extra filter diagnostics were returned.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Backend Data</div>
            <div className="grid gap-3">
              <JsonBlock title="Request Filters" value={detail.request_filters} defaultOpen />
              <JsonBlock title="Asset Metadata" value={detail.asset_metadata} />
              <JsonBlock title="Last Candle" value={marketData?.last_candle} />
              <JsonBlock title="Recent Candles" value={marketData?.recent_candles} />
              <JsonBlock title="Channels" value={detail.channels} />
              <JsonBlock title="Confluence Channels" value={detail.confluence_channels} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
