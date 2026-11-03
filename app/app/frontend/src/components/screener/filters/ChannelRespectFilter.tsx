import type { ChannelRespect } from "@/types/screener";

interface Props {
  value: ChannelRespect | null;
  onChange: (v: ChannelRespect | null) => void;
}

const CHANNEL_TYPES = ["lrc", "regression", "trend"] as const;

export function ChannelRespectFilter({ value, onChange }: Props) {
  const enabled = value !== null;

  const toggle = () => {
    if (enabled) {
      onChange(null);
    } else {
      onChange({ channel_type: "trend", line: "both", min_respect: 2, max_respect: null, tolerance_pct: 0.1, cluster_gap: 3, touch_type: "wick" });
    }
  };

  const update = (patch: Partial<ChannelRespect>) => {
    if (value) onChange({ ...value, ...patch });
  };

  const lineToSelection = (line?: ChannelRespect["line"]) => {
    switch (line) {
      case "upper":
        return { upper: true, middle: false, lower: false };
      case "lower":
        return { upper: false, middle: false, lower: true };
      case "both":
        return { upper: true, middle: false, lower: true };
      case "upper_middle":
        return { upper: true, middle: true, lower: false };
      case "lower_middle":
        return { upper: false, middle: true, lower: true };
      case "all":
        return { upper: true, middle: true, lower: true };
      case "middle":
      default:
        return { upper: false, middle: true, lower: false };
    }
  };

  const selectionToLine = (upper: boolean, middle: boolean, lower: boolean): ChannelRespect["line"] => {
    if (upper && middle && lower) return "all";
    if (upper && lower) return "both";
    if (upper && middle) return "upper_middle";
    if (lower && middle) return "lower_middle";
    if (upper) return "upper";
    if (lower) return "lower";
    return "middle";
  };

  const { upper: upperSelected, middle: middleSelected, lower: lowerSelected } = lineToSelection(value?.line);

  const updateLineSelection = (nextUpper: boolean, nextMiddle: boolean, nextLower: boolean) => {
    if (!value) return;
    update({ line: selectionToLine(nextUpper, nextMiddle, nextLower) });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className={`h-4 w-4 rounded border transition-colors ${enabled ? "bg-primary border-primary" : "border-border"}`}
        />
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Channel Respect</label>
      </div>
      {enabled && value && (
        <div className="grid grid-cols-2 gap-2 pl-6">
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Channel</div>
            <select value={value.channel_type} onChange={e => update({ channel_type: e.target.value as ChannelRespect["channel_type"] })}
              className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground">
              {CHANNEL_TYPES.map(t => <option key={t} value={t}>{t === "lrc" ? "Linear Regression" : t === "regression" ? "Regression" : "Trend"}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Line To Respect</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => updateLineSelection(!upperSelected, middleSelected, lowerSelected)}
                className={`rounded border px-2 py-1 text-[10px] transition-colors ${
                  upperSelected ? "border-primary bg-primary/10 text-accent-foreground" : "border-border text-muted-foreground"
                }`}
              >
                Upper
              </button>
              <button
                onClick={() => updateLineSelection(upperSelected, middleSelected, !lowerSelected)}
                className={`rounded border px-2 py-1 text-[10px] transition-colors ${
                  lowerSelected ? "border-primary bg-primary/10 text-accent-foreground" : "border-border text-muted-foreground"
                }`}
              >
                Lower
              </button>
              <button
                onClick={() => updateLineSelection(upperSelected, !middleSelected, lowerSelected)}
                className={`rounded border px-2 py-1 text-[10px] transition-colors ${
                  middleSelected ? "border-primary bg-primary/10 text-accent-foreground" : "border-border text-muted-foreground"
                }`}
              >
                Middle
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground">
              You can pair Middle with Upper or Lower, or select all three.
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Minimum Touches</div>
            <input type="number" min="1" value={value.min_respect ?? ""} onChange={e => update({ min_respect: e.target.value ? Number(e.target.value) : null })}
              className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground" />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Maximum Touches</div>
            <input type="number" min="1" value={value.max_respect ?? ""} onChange={e => update({ max_respect: e.target.value ? Number(e.target.value) : null })}
              className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground" />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Tolerance %</div>
            <input
              type="number"
              min="0"
              step="0.1"
              value={value.tolerance_pct}
              onChange={e => update({ tolerance_pct: Number(e.target.value) || 0 })}
              className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
            />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Touch Detail</div>
            <select
              value={value.touch_type ?? "wick"}
              onChange={e => update({ touch_type: e.target.value as ChannelRespect["touch_type"] })}
              className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
            >
              <option value="wick">Wick</option>
              <option value="body">Body</option>
              <option value="both">Wick / Body</option>
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Cluster Window (3-5 candles)</div>
            <input
              type="number"
              min="3"
              max="5"
              value={value.cluster_gap}
              onChange={e => update({ cluster_gap: Math.min(5, Math.max(3, Number(e.target.value) || 3)) })}
              className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
            />
          </div>
        </div>
      )}
    </div>
  );
}
