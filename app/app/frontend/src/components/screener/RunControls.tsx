import { Loader2, Play } from "lucide-react";
import type { useScreener } from "@/hooks/useScreener";

type ScreenerState = ReturnType<typeof useScreener>;

export function RunControls({ state }: { state: ScreenerState }) {
  const { timeframeMode, loading, runSingle, runGateEntry } = state;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/50 p-1.5 backdrop-blur-sm">
      {timeframeMode === "single" ? (
        <button
          onClick={runSingle}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_12px_32px_hsl(var(--primary)_/_0.3)] transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Scan
        </button>
      ) : (
        <button
          onClick={runGateEntry}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_12px_32px_hsl(var(--primary)_/_0.3)] transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Scan
        </button>
      )}
    </div>
  );
}
