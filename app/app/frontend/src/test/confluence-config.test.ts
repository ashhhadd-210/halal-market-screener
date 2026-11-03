import { describe, expect, it } from "vitest";

import { normalizeConfluenceConfig } from "@/types/screener";

describe("normalizeConfluenceConfig", () => {
  it("preserves breakout requests", () => {
    const config = normalizeConfluenceConfig({
      type: "breakout",
      channels: ["trend", "lrc"],
      sources: [
        { id: "trend_0", channel_type: "trend", selection: "top_line", length: 8 },
        { id: "lrc_1", channel_type: "lrc", selection: "upper", length: 100 },
      ],
      liquidity_sweep: false,
      lookback_candles: 4,
      tolerance_pct: 0.1,
    });

    expect(config?.type).toBe("breakout");
    expect(config?.sources?.[0].selection).toBe("top_line");
  });

  it("preserves any requests", () => {
    const config = normalizeConfluenceConfig({
      type: "any",
      channels: ["trend", "regression"],
      sources: [
        { id: "trend_0", channel_type: "trend", selection: "bottom_line", length: 8 },
        { id: "regression_1", channel_type: "regression", selection: "upper", length: 200 },
      ],
      liquidity_sweep: true,
      lookback_candles: 4,
      tolerance_pct: 0.2,
    });

    expect(config?.type).toBe("any");
  });

  it("normalizes legacy role reversal configs into two explicit sources", () => {
    const config = normalizeConfluenceConfig({
      type: "role_reversal",
      channels: ["trend", "lrc", "regression"],
      sources: [
        { id: "trend_0", channel_type: "trend", length: 8 } as any,
        { id: "lrc_1", channel_type: "lrc", length: 100 } as any,
        { id: "reg_2", channel_type: "regression", length: 200, selection: "upper" },
      ],
      liquidity_sweep: false,
      lookback_candles: 9,
      tolerance_pct: 0.1,
    });

    expect(config?.type).toBe("breakout");
    expect(config?.sources).toHaveLength(2);
    expect(config?.sources?.[0].selection).toBe("top_line");
    expect(config?.sources?.[1].selection).toBe("upper");
    expect(config?.lookback_candles).toBe(4);
  });
});
