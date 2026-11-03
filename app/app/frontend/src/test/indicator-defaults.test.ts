import { beforeEach, describe, expect, it } from "vitest";

import {
  getDefaultChannelLength,
  getDefaultIndicatorConfig,
  normalizeIndicatorConfig,
} from "@/types/screener";

describe("indicator defaults", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses TradingView-style defaults for EMA and channel indicators", () => {
    expect(getDefaultIndicatorConfig("ema")).toMatchObject({ length: 9 });
    expect(getDefaultIndicatorConfig("lrc")).toMatchObject({ length: 100 });
    expect(getDefaultIndicatorConfig("regression")).toMatchObject({ length: 200 });
    expect(getDefaultIndicatorConfig("trend")).toMatchObject({
      length: 8,
      show_last_channel: true,
      wait_for_break: true,
    });
  });

  it("uses the same default channel lengths in confluence helpers", () => {
    expect(getDefaultChannelLength("lrc")).toBe(100);
    expect(getDefaultChannelLength("regression")).toBe(200);
    expect(getDefaultChannelLength("trend")).toBe(8);
  });

  it("fills missing indicator config from the updated defaults", () => {
    expect(
      normalizeIndicatorConfig({
        name: "ema",
        timeframe: "single",
        config: { rule: "below" },
      }),
    ).toMatchObject({
      config: {
        length: 9,
        rule: "below",
      },
    });
  });
});
