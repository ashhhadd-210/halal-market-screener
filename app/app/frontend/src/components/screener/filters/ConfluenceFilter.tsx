import {
  createConfluenceSource,
  formatConfluenceSelectionLabel,
  getConfluenceSelectionOptions,
  getDefaultChannelLength,
  getDefaultConfluenceSelection,
  normalizeConfluenceConfig,
} from "@/types/screener";
import type { ChannelType, Confluence } from "@/types/screener";

interface Props {
  value: Confluence | null;
  onChange: (v: Confluence | null) => void;
}

const TYPES = ["bullish", "bearish", "breakout", "any"] as const;
const CHANNELS: ChannelType[] = ["lrc", "regression", "trend"];
const TYPE_LABELS: Record<(typeof TYPES)[number], string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  breakout: "Breakout",
  any: "Any",
};
const TYPE_HELPERS: Record<(typeof TYPES)[number], string> = {
  bullish: "Dual support logic across exactly two selected lines or zones.",
  bearish: "Dual resistance logic across exactly two selected lines or zones.",
  breakout: "Sequential support or resistance transitions across source 1 then source 2.",
  any: "Match any bullish, bearish, or breakout confluence scenario.",
};

export function ConfluenceFilter({ value, onChange }: Props) {
  const current = normalizeConfluenceConfig(value);
  const enabled = current !== null;

  const toggle = () => {
    if (enabled) {
      onChange(null);
      return;
    }

    const type: Confluence["type"] = "bullish";
    const sources = [
      createConfluenceSource("trend", {}, 0, type),
      createConfluenceSource("lrc", {}, 1, type),
    ];

    onChange({
      type,
      channels: sources.map((source) => source.channel_type),
      sources,
      liquidity_sweep: false,
      lookback_candles: 4,
      tolerance_pct: 0.1,
    });
  };

  const update = (patch: Partial<Confluence>) => {
    if (!current) return;
    onChange(normalizeConfluenceConfig({ ...current, ...patch }));
  };

  const updateType = (type: (typeof TYPES)[number]) => {
    if (!current) return;

    const nextSources = (current.sources ?? []).map((source, index) =>
      createConfluenceSource(
        source.channel_type,
        {
          ...source,
          selection: getDefaultConfluenceSelection(source.channel_type, type, index),
        },
        index,
        type,
      ),
    );

    onChange(
      normalizeConfluenceConfig({
        ...current,
        type,
        sources: nextSources,
        channels: nextSources.map((source) => source.channel_type),
      }),
    );
  };

  const updateSources = (
    updater: (sources: NonNullable<Confluence["sources"]>) => NonNullable<Confluence["sources"]>,
  ) => {
    if (!current) return;
    const nextSources = updater(current.sources ?? []);
    update({
      sources: nextSources,
      channels: nextSources.map((source) => source.channel_type),
    });
  };

  const updateSource = (
    id: string,
    patch: Partial<NonNullable<Confluence["sources"]>[number]>,
  ) => {
    if (!current) return;

    updateSources((sources) =>
      sources.map((source, index) => {
        if (source.id !== id) {
          return source;
        }

        const nextChannelType = (patch.channel_type ?? source.channel_type) as ChannelType;
        const nextSelection =
          patch.selection
          ?? (
            patch.channel_type && patch.channel_type !== source.channel_type
              ? getDefaultConfluenceSelection(nextChannelType, current.type, index)
              : source.selection
          );
        const nextLength =
          patch.channel_type && patch.channel_type !== source.channel_type
            ? getDefaultChannelLength(nextChannelType)
            : Math.max(
                2,
                Number(patch.length ?? source.length) || getDefaultChannelLength(nextChannelType),
              );

        return createConfluenceSource(
          nextChannelType,
          {
            ...source,
            ...patch,
            id: source.id,
            selection: nextSelection,
            length: nextLength,
          },
          index,
          current.type,
        );
      }),
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className={`h-4 w-4 rounded border transition-colors ${enabled ? "bg-primary border-primary" : "border-border"}`}
        />
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Channel Confluence</label>
      </div>
      {enabled && current && (
        <div className="space-y-2 pl-6">
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Signal Type</div>
            <div className="flex flex-wrap gap-1">
              {TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => updateType(type)}
                  className={`px-2 py-0.5 rounded text-[10px] border capitalize transition-colors ${
                    current.type === type
                      ? "border-primary bg-primary/10 text-accent-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground/80">
              {TYPE_HELPERS[current.type]}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">
              Exactly 2 selected lines or zones. Source order matters for step 1 then step 2 logic.
            </div>

            <div className="space-y-2">
              {(current.sources ?? []).map((source, index) => (
                <div
                  key={source.id}
                  className="grid grid-cols-[1fr_1fr_92px] gap-2 rounded border border-border/70 p-2"
                >
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Source {index + 1} Indicator</div>
                    <select
                      value={source.channel_type}
                      onChange={(e) =>
                        updateSource(source.id, {
                          channel_type: e.target.value as ChannelType,
                        })
                      }
                      className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
                    >
                      {CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>
                          {channel === "lrc"
                            ? "LRC"
                            : channel === "regression"
                              ? "Regression Channel"
                              : "Trend Channel"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Line / Zone</div>
                    <select
                      value={source.selection}
                      onChange={(e) =>
                        updateSource(source.id, {
                          selection: e.target.value as NonNullable<Confluence["sources"]>[number]["selection"],
                        })
                      }
                      className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs capitalize text-foreground"
                    >
                      {getConfluenceSelectionOptions(source.channel_type).map((selection) => (
                        <option key={selection} value={selection}>
                          {formatConfluenceSelectionLabel(selection)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Length</div>
                    <input
                      type="number"
                      min="2"
                      value={source.length}
                      onChange={(e) =>
                        updateSource(source.id, {
                          length: Math.max(
                            2,
                            Number(e.target.value) || getDefaultChannelLength(source.channel_type),
                          ),
                        })
                      }
                      className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
                    />
                  </div>

                  <div className="col-span-3 text-[10px] text-muted-foreground/80">
                    Source {index + 1} uses{" "}
                    {source.channel_type === "lrc"
                      ? "LRC"
                      : source.channel_type === "regression"
                        ? "Regression Channel"
                        : "Trend Channel"}{" "}
                    on {formatConfluenceSelectionLabel(source.selection)} with length {source.length}.
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => update({ liquidity_sweep: !current.liquidity_sweep })}
              className={`h-3.5 w-3.5 rounded border transition-colors ${current.liquidity_sweep ? "bg-primary border-primary" : "border-border"}`}
            />
            <span className="text-[10px] text-muted-foreground">Require liquidity sweep</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground">Lookback Candles</div>
              <input
                type="number"
                min="1"
                max="4"
                value={current.lookback_candles}
                onChange={(e) =>
                  update({
                    lookback_candles: Math.min(
                      4,
                      Math.max(1, Number(e.target.value) || 1),
                    ),
                  })
                }
                className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground">Tolerance %</div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={current.tolerance_pct}
                onChange={(e) => update({ tolerance_pct: Number(e.target.value) || 0 })}
                className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
