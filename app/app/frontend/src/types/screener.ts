export type AssetType = "stocks" | "crypto";
export type ScanStage = "single" | "gate" | "entry";

export type TimeframeMode = "single" | "gate_entry";

export type ComplianceStatus =
  | "compliant"
  | "non-compliant"
  | "questionable";

export type IndicatorTimeframe = "single" | "primary" | "secondary";

export type IndicatorName =
  | "rsi"
  | "wavetrend"
  | "aroon"
  | "lrc"
  | "regression"
  | "trend"
  | "linreg_candles"
  | "ema"
  | "macd"
  | "volume"
  | "relative_volume"
  | "current_volume"
  | "float"
  | "shares_outstanding"
  | "volatility";

export type ChannelType = "lrc" | "regression" | "trend";
export type ChannelLine =
  | "upper"
  | "middle"
  | "lower"
  | "both"
  | "upper_middle"
  | "lower_middle"
  | "all";
export type ConfluenceSelection =
  | "upper"
  | "middle"
  | "lower"
  | "top_line"
  | "middle_line"
  | "bottom_line"
  | "top_zone"
  | "bottom_zone";

export interface IndicatorConfig {
  name: IndicatorName;
  timeframe: IndicatorTimeframe;
  config: Record<string, unknown>;
}

export interface AreaRule {
  area: string;
  action: string;
  window: number | null;
  tolerance?: number | null;
  touch_type?: string | null;
  breach_type?: string | null;
  breach_direction?: string | null;
  confirmation?: boolean;
  confirmation_type?: string | null;
  confirmation_types?: string[] | null;
  confirmation_patterns?: string[] | null;
  confirmation_window?: number | null;
}

export interface ChannelRespect {
  channel_type: ChannelType;
  line: ChannelLine;
  min_respect?: number | null;
  max_respect?: number | null;
  tolerance_pct: number;
  cluster_gap: number;
  touch_type?: "wick" | "body" | "both";
}

export interface ConfluenceSource {
  id: string;
  channel_type: ChannelType;
  selection: ConfluenceSelection;
  length: number;
  width_coeff?: number | null;
  upper_dev?: number | null;
  lower_dev?: number | null;
  window_type?: "continuous" | "interval" | null;
  interval_step?: number | null;
}

export interface Confluence {
  type: "bullish" | "bearish" | "role_reversal" | "breakout" | "any";
  channels?: ChannelType[];
  sources?: ConfluenceSource[];
  liquidity_sweep: boolean;
  lookback_candles: number;
  tolerance_pct: number;
}

export interface PriceRange {
  min_price?: number | null;
  max_price?: number | null;
}

export interface ScreenerRequest {
  asset_type: AssetType;
  stock_sources: string[] | null;
  compliance_status: ComplianceStatus | null;
  compliance_standards: string[] | null;
  exchanges: string[] | null;
  excluded_categories: string[] | null;
  timeframe_mode: TimeframeMode;
  single_timeframe: string | null;
  gate_timeframe: string | null;
  entry_timeframe: string | null;
  gate_session_id?: string | null;
  indicators: IndicatorConfig[];
  channel_respect: ChannelRespect | null;
  confluence: Confluence | null;
  price_range: PriceRange | null;
}

export interface ScreenerResult {
  symbol: string;
  price: number;
  asset_type: AssetType;
  data_source: string;
  scan_stage?: ScanStage | null;
  name?: string | null;
  category?: string | null;
  cmc_id?: number | null;
  rank?: number | null;
  compliance_status?: string | null;
  report_date?: string | null;
  purification_ratio?: number | null;
  candles_count?: number | null;
  last_candle_time?: number | null;
  exchange?: string | null;
  exchange_availability?: string[] | null;
  timeframe: string;
  note?: string | null;
  stickers: string[];
  matched_indicators?: string[] | null;
}

export interface IndicatorDetail {
  name: string;
  timeframe_scope?: string | null;
  passed: boolean;
  sticker?: string | null;
  config: Record<string, unknown>;
}

export interface FilterDetail {
  name: string;
  passed: boolean;
  summary?: string | null;
  sticker?: string | null;
  details: Record<string, unknown>;
}

export interface MarketDataDetail {
  candles_provider?: string | null;
  next_refresh_at?: number | null;
  shares_outstanding?: number | null;
  float_shares?: number | null;
  last_candle?: Record<string, unknown> | null;
  recent_candles: Record<string, unknown>[];
}

export interface ScreenerResultDetail extends ScreenerResult {
  asset_metadata: Record<string, unknown>;
  request_filters: Record<string, unknown>;
  indicator_details: IndicatorDetail[];
  filter_details: FilterDetail[];
  market_data: MarketDataDetail;
  channels: Record<string, unknown>;
  confluence_channels: Record<string, unknown>;
}

export interface ScreenerDetailRequest {
  symbol: string;
  asset_type: AssetType;
  timeframe: string;
  scan_stage: ScanStage;
  request: ScreenerRequest;
}

export interface ScreenerDetailResponse {
  detail: ScreenerResultDetail | null;
}

export interface CryptoExchangeOption {
  exchange: string;
  coin_count: number;
}

export interface CryptoExchangeOptionsResponse {
  exchanges: CryptoExchangeOption[];
}

export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1day"];

export const EXCLUDED_CATEGORIES = [
  { label: "Memecoins", value: "meme" },
  { label: "Gambling", value: "gambling" },
  { label: "Interest", value: "interest" },
  { label: "Adult", value: "adult" },
  { label: "Scam", value: "scam" },
];

export type IndicatorCategory =
  | "momentum"
  | "trend"
  | "volume"
  | "channel"
  | "confluence";

export const INDICATOR_CATEGORY_COLORS = {
  momentum: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },
  trend: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  volume: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
  },
  channel: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  confluence: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
  },
} satisfies Record<
  IndicatorCategory,
  { bg: string; text: string; border: string }
>;

export const INDICATOR_CATEGORY_MAP: Record<IndicatorName, IndicatorCategory> = {
  rsi: "momentum",
  wavetrend: "momentum",
  aroon: "trend",
  lrc: "channel",
  regression: "channel",
  trend: "channel",
  linreg_candles: "trend",
  ema: "trend",
  macd: "momentum",
  volume: "volume",
  relative_volume: "volume",
  current_volume: "volume",
  float: "volume",
  shares_outstanding: "volume",
  volatility: "trend",
};

export type IndicatorFieldType =
  | "number"
  | "select"
  | "multi-select"
  | "boolean"
  | "area-list";

export interface IndicatorFieldDefinition {
  key: string;
  label: string;
  type: IndicatorFieldType;
  options?: readonly string[];
}

export interface IndicatorDefinition {
  name: IndicatorName;
  fields: IndicatorFieldDefinition[];
}

const COMMON_DIRECTIONS = [
  "rising",
  "falling",
  "turning_up",
  "turning_down",
] as const;

const RSI_DIRECTIONS = [
  "turning_up",
  "turning_down",
] as const;

const LRC_R_FILTER_OPTIONS = [
  "ignore",
  "strong",
  "balanced",
] as const;

export const CONFIRMATION_TYPES = [
  "bullish",
  "bearish",
  "strong_bullish",
  "strong_bearish",
] as const;

const BULLISH_CONFIRMATION_PATTERNS = [
  "bullish_engulfing",
  "hammer",
  "morning_star",
  "piercing_line",
  "three_white_soldiers",
  "bullish_marubozu",
  "strong_breakout_candle",
  "tweezer_bottom",
  "bullish_pin_bar",
  "double_bottom",
] as const;

const BEARISH_CONFIRMATION_PATTERNS = [
  "bearish_engulfing",
  "shooting_star",
  "evening_star",
  "dark_cloud_cover",
  "three_black_crows",
  "bearish_marubozu",
  "strong_breakdown_candle",
  "tweezer_top",
  "bearish_pin_bar",
  "double_top",
] as const;

export const CONFIRMATION_PATTERNS = [
  ...BULLISH_CONFIRMATION_PATTERNS,
  ...BEARISH_CONFIRMATION_PATTERNS,
] as const;

const TOUCH_TYPES = [
  "wick",
  "body",
  "both",
] as const;

const BREACH_DIRECTIONS = [
  "any",
  "up",
  "down",
] as const;

export const TREND_CHANNEL_AREAS = [
  "top_line",
  "middle_line",
  "bottom_line",
  "top_zone",
  "bottom_zone",
] as const;

export const TREND_CHANNEL_LINE_ACTIONS = [
  "touched",
  "closed_above",
  "closed_below",
  "on_line",
] as const;

export const TREND_CHANNEL_ZONE_ACTIONS = [
  "entered",
  "rejected",
  "breach",
] as const;

export const DEFAULT_TREND_AREA_RULE: AreaRule = {
  area: "top_line",
  action: "touched",
  window: 1,
  tolerance: null,
  touch_type: "wick",
  breach_type: "wick",
  breach_direction: "any",
  confirmation: false,
  confirmation_type: null,
  confirmation_types: [],
  confirmation_patterns: [],
  confirmation_window: null,
};

export const INDICATOR_DEFINITIONS: IndicatorDefinition[] = [
  {
    name: "rsi",
    fields: [
      { key: "length", label: "Length (Speed)", type: "number" },
      {
        key: "location",
        label: "Zone",
        type: "select",
        options: ["oversold", "neutral", "overbought"],
      },
      {
        key: "direction",
        label: "Momentum",
        type: "select",
        options: RSI_DIRECTIONS,
      },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
      { key: "window", label: "How Many Candles", type: "number" },
      { key: "confirmation", label: "Require Confirmation", type: "boolean" },
      {
        key: "confirmation_types",
        label: "Confirmation Candle",
        type: "multi-select",
        options: CONFIRMATION_TYPES,
      },
      {
        key: "confirmation_patterns",
        label: "Pattern Confirmations",
        type: "multi-select",
        options: CONFIRMATION_PATTERNS,
      },
      { key: "confirmation_window", label: "Confirmation Window", type: "number" },
    ],
  },
  {
    name: "wavetrend",
    fields: [
      { key: "channel_length", label: "Channel Length", type: "number" },
      { key: "average_length", label: "Average Length", type: "number" },
      { key: "signal_length", label: "Signal Length", type: "number" },
      {
        key: "zone",
        label: "Zone",
        type: "select",
        options: ["oversold", "neutral", "overbought"],
      },
      {
        key: "direction",
        label: "Momentum",
        type: "select",
        options: [
          "rising",
          "falling",
          "turning_up",
          "turning_down",
          "crossed_up",
          "crossed_down",
        ],
      },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
      { key: "window", label: "How Many Candles", type: "number" },
      { key: "confirmation", label: "Require Confirmation", type: "boolean" },
      {
        key: "confirmation_types",
        label: "Confirmation Candle",
        type: "multi-select",
        options: CONFIRMATION_TYPES,
      },
      {
        key: "confirmation_patterns",
        label: "Pattern Confirmations",
        type: "multi-select",
        options: CONFIRMATION_PATTERNS,
      },
      { key: "confirmation_window", label: "Confirmation Window", type: "number" },
    ],
  },
  {
    name: "aroon",
    fields: [
      { key: "length", label: "Length (Speed)", type: "number" },
      {
        key: "level",
        label: "Strength",
        type: "select",
        options: [
          "above_50",
          "between_50_0",
          "near_0",
          "between_0_-50",
          "below_-50",
        ],
      },
      {
        key: "direction",
        label: "Momentum",
        type: "select",
        options: COMMON_DIRECTIONS,
      },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
      { key: "window", label: "How Many Candles", type: "number" },
      { key: "confirmation", label: "Require Confirmation", type: "boolean" },
      {
        key: "confirmation_types",
        label: "Confirmation Candle",
        type: "multi-select",
        options: CONFIRMATION_TYPES,
      },
      {
        key: "confirmation_patterns",
        label: "Pattern Confirmations",
        type: "multi-select",
        options: CONFIRMATION_PATTERNS,
      },
      { key: "confirmation_window", label: "Confirmation Window", type: "number" },
    ],
  },
  {
    name: "lrc",
    fields: [
      { key: "length", label: "Lookback", type: "number" },
      { key: "upper_dev", label: "Upper Deviation", type: "number" },
      { key: "lower_dev", label: "Lower Deviation", type: "number" },
      {
        key: "lines",
        label: "Line",
        type: "multi-select",
        options: ["upper", "middle", "lower"],
      },
      {
        key: "action",
        label: "Signal",
        type: "select",
        options: ["touch", "close_above", "close_below", "stay_above", "stay_below"],
      },
      {
        key: "touch_type",
        label: "Touch Details",
        type: "select",
        options: TOUCH_TYPES,
      },
      { key: "window", label: "Time Window (Candles)", type: "number" },
      { key: "tolerance", label: "Tolerance %", type: "number" },
      {
        key: "r_filter",
        label: "R Filter",
        type: "select",
        options: LRC_R_FILTER_OPTIONS,
      },
      { key: "confirmation", label: "Require Confirmation", type: "boolean" },
      {
        key: "confirmation_types",
        label: "Confirmation Candle",
        type: "multi-select",
        options: CONFIRMATION_TYPES,
      },
      {
        key: "confirmation_patterns",
        label: "Pattern Confirmations",
        type: "multi-select",
        options: CONFIRMATION_PATTERNS,
      },
      { key: "confirmation_window", label: "Confirmation Window", type: "number" },
    ],
  },
  {
    name: "regression",
    fields: [
      { key: "length", label: "Lookback", type: "number" },
      { key: "width_coeff", label: "Width Coefficient", type: "number" },
      {
        key: "window_type",
        label: "Window Type",
        type: "select",
        options: ["continuous", "interval"],
      },
      { key: "interval_step", label: "Interval Step", type: "number" },
      {
        key: "lines",
        label: "Line",
        type: "multi-select",
        options: ["upper", "middle", "lower", "q1", "q3"],
      },
      {
        key: "action",
        label: "Signal",
        type: "select",
        options: ["touch", "close_above", "close_below", "stay_above", "stay_below"],
      },
      {
        key: "touch_type",
        label: "Touch Details",
        type: "select",
        options: TOUCH_TYPES,
      },
      { key: "window", label: "Time Window (Candles)", type: "number" },
      { key: "tolerance", label: "Tolerance %", type: "number" },
      { key: "confirmation", label: "Require Confirmation", type: "boolean" },
      {
        key: "confirmation_types",
        label: "Confirmation Candle",
        type: "multi-select",
        options: CONFIRMATION_TYPES,
      },
      {
        key: "confirmation_patterns",
        label: "Pattern Confirmations",
        type: "multi-select",
        options: CONFIRMATION_PATTERNS,
      },
      { key: "confirmation_window", label: "Confirmation Window", type: "number" },
    ],
  },
  {
    name: "trend",
    fields: [
      { key: "length", label: "Lookback", type: "number" },
      { key: "show_last_channel", label: "Show Last Channel", type: "boolean" },
      { key: "wait_for_break", label: "Wait For Break", type: "boolean" },
      { key: "areas", label: "Area Rules", type: "area-list" },
    ],
  },
  {
    name: "linreg_candles",
    fields: [
      { key: "lr_length", label: "Line Length", type: "number" },
      { key: "signal_smoothing", label: "Signal Smoothing", type: "number" },
      {
        key: "price_position",
        label: "Position",
        type: "select",
        options: ["above", "below", "on", "piercing_from_below", "piercing_from_above"],
      },
      {
        key: "close_location",
        label: "Close Location",
        type: "select",
        options: ["close_above", "close_below", "close_on"],
      },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
      { key: "window", label: "How Many Candles", type: "number" },
      { key: "confirmation", label: "Require Confirmation", type: "boolean" },
      {
        key: "confirmation_type",
        label: "Confirmation Candle",
        type: "select",
        options: ["bullish", "bearish", "strong_bullish", "strong_bearish"],
      },
      {
        key: "confirmation_patterns",
        label: "Pattern Confirmations",
        type: "multi-select",
        options: CONFIRMATION_PATTERNS,
      },
      { key: "confirmation_window", label: "Confirmation Window", type: "number" },
    ],
  },
  {
    name: "ema",
    fields: [
      { key: "length", label: "EMA Length", type: "number" },
      {
        key: "rule",
        label: "Signal",
        type: "select",
        options: ["above", "below", "touch"],
      },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
    ],
  },
  {
    name: "macd",
    fields: [
      { key: "rule", label: "Signal", type: "select", options: ["bullish_cross", "bearish_cross", "above_zero", "below_zero"] },
      { key: "fast", label: "Fast Length", type: "number" },
      { key: "slow", label: "Slow Length", type: "number" },
      { key: "signal", label: "Signal Length", type: "number" },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
    ],
  },
  {
    name: "volume",
    fields: [
      { key: "length", label: "Average Length", type: "number" },
      { key: "multiplier", label: "Spike Strength", type: "number" },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
    ],
  },
  {
    name: "relative_volume",
    fields: [
      { key: "length", label: "Average Length", type: "number" },
      { key: "min_ratio", label: "Minimum RVOL", type: "number" },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
    ],
  },
  {
    name: "current_volume",
    fields: [
      { key: "min_value", label: "Minimum Volume", type: "number" },
      { key: "max_value", label: "Maximum Volume", type: "number" },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
    ],
  },
  {
    name: "float",
    fields: [
      { key: "min_value", label: "Minimum Float", type: "number" },
      { key: "max_value", label: "Maximum Float", type: "number" },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
    ],
  },
  {
    name: "shares_outstanding",
    fields: [
      { key: "min_value", label: "Minimum Shares", type: "number" },
      { key: "max_value", label: "Maximum Shares", type: "number" },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
    ],
  },
  {
    name: "volatility",
    fields: [
      { key: "length", label: "Lookback", type: "number" },
      { key: "min_pct", label: "Minimum Volatility %", type: "number" },
      { key: "max_pct", label: "Maximum Volatility %", type: "number" },
      { key: "tolerance_pct", label: "Tolerance %", type: "number" },
    ],
  },
];

const INDICATOR_DEFAULT_CONFIGS: Record<IndicatorName, Record<string, unknown>> = {
  rsi: {
    length: 14,
    location: "oversold",
    direction: "turning_up",
    tolerance_pct: 0,
    window: 1,
    confirmation: false,
    confirmation_type: null,
    confirmation_types: [],
    confirmation_patterns: [],
    confirmation_window: null,
  },
  wavetrend: {
    channel_length: 10,
    average_length: 21,
    signal_length: 4,
    zone: "oversold",
    direction: "turning_up",
    tolerance_pct: 0,
    window: 1,
    confirmation: false,
    confirmation_type: null,
    confirmation_types: [],
    confirmation_patterns: [],
    confirmation_window: null,
  },
  aroon: {
    length: 14,
    level: "above_50",
    direction: "rising",
    tolerance_pct: 0,
    window: 1,
    confirmation: false,
    confirmation_type: null,
    confirmation_types: [],
    confirmation_patterns: [],
    confirmation_window: null,
  },
  lrc: {
    length: 100,
    upper_dev: 2,
    lower_dev: 2,
    lines: ["middle"],
    action: "touch",
    touch_type: "wick",
    window: 1,
    tolerance: 0,
    r_filter: "ignore",
    confirmation: false,
    confirmation_type: null,
    confirmation_types: [],
    confirmation_patterns: [],
    confirmation_window: null,
  },
  regression: {
    length: 200,
    width_coeff: 1,
    window_type: "continuous",
    interval_step: 1,
    lines: ["middle"],
    action: "touch",
    touch_type: "wick",
    window: 1,
    tolerance: 0,
    confirmation: false,
    confirmation_type: null,
    confirmation_types: [],
    confirmation_patterns: [],
    confirmation_window: null,
  },
  trend: {
    length: 8,
    show_last_channel: true,
    wait_for_break: true,
    areas: [{ ...DEFAULT_TREND_AREA_RULE }],
  },
  linreg_candles: {
    lr_length: 11,
    signal_smoothing: 7,
    price_position: "above",
    tolerance_pct: 0,
    window: 1,
    confirmation: false,
    confirmation_type: null,
    confirmation_window: null,
    confirmation_patterns: [],
  },
  ema: {
    length: 9,
    rule: "above",
    tolerance_pct: 0,
  },
  macd: {
    rule: "bullish_cross",
    fast: 12,
    slow: 26,
    signal: 9,
    tolerance_pct: 0,
  },
  volume: {
    length: 20,
    multiplier: 2,
    tolerance_pct: 0,
  },
  relative_volume: {
    length: 20,
    min_ratio: 1.5,
    tolerance_pct: 0,
  },
  current_volume: {
    min_value: 0,
    max_value: null,
    tolerance_pct: 0,
  },
  float: {
    min_value: 0,
    max_value: null,
    tolerance_pct: 0,
  },
  shares_outstanding: {
    min_value: 0,
    max_value: null,
    tolerance_pct: 0,
  },
  volatility: {
    length: 20,
    min_pct: 0,
    max_pct: null,
    tolerance_pct: 0,
  },
};

export function getAllDefaultIndicatorConfigs(): Record<IndicatorName, Record<string, unknown>> {
  return structuredClone(INDICATOR_DEFAULT_CONFIGS);
}

export function getDefaultIndicatorConfig(name: IndicatorName): Record<string, unknown> {
  const config = INDICATOR_DEFAULT_CONFIGS[name];

  if (!config) {
    return {};
  }

  let runtimeOverrides: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem("screener.indicatorDefaults");
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      if (parsed && typeof parsed === "object") {
        const normalized = { ...parsed };
        if (normalized.volume_spike && !normalized.volume) {
          normalized.volume = normalized.volume_spike;
        }
        if (normalized[name] && typeof normalized[name] === "object") {
          runtimeOverrides = normalized[name];
        }
      }
    }
  } catch {
    runtimeOverrides = {};
  }

  return structuredClone({
    ...config,
    ...runtimeOverrides,
  });
}

export function normalizeIndicatorConfig(indicator: IndicatorConfig): IndicatorConfig {
  const defaults = getDefaultIndicatorConfig(indicator.name);

  return {
    ...indicator,
    config: {
      ...defaults,
      ...(indicator.config ?? {}),
    },
  };
}

export function getDefaultChannelLength(channelType: ChannelType): number {
  switch (channelType) {
    case "lrc":
      return 100;
    case "regression":
      return 200;
    case "trend":
      return 8;
    default:
      return 20;
  }
}

export function getConfluenceSelectionOptions(
  channelType: ChannelType,
): readonly ConfluenceSelection[] {
  if (channelType === "trend") {
    return [
      "top_line",
      "middle_line",
      "bottom_line",
      "top_zone",
      "bottom_zone",
    ] as const;
  }

  return ["upper", "middle", "lower"] as const;
}

export function getDefaultConfluenceSelection(
  channelType: ChannelType,
  confluenceType: Confluence["type"] = "bullish",
  sourceIndex = 0,
): ConfluenceSelection {
  if (confluenceType === "role_reversal" && sourceIndex === 1) {
    return channelType === "trend" ? "bottom_line" : "lower";
  }

  if (confluenceType === "bullish") {
    return channelType === "trend" ? "bottom_line" : "lower";
  }

  if (confluenceType === "any" && sourceIndex === 0) {
    return channelType === "trend" ? "bottom_line" : "lower";
  }

  return channelType === "trend" ? "top_line" : "upper";
}

export function formatConfluenceSelectionLabel(selection: ConfluenceSelection): string {
  return selection.replace(/_/g, " ");
}

function buildConfluenceSourceId(channelType: ChannelType, suffix?: string): string {
  if (suffix) {
    return `${channelType}-${suffix}`;
  }

  return `${channelType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createConfluenceSource(
  channelType: ChannelType,
  overrides: Partial<ConfluenceSource> = {},
  fallbackIndex?: number,
  confluenceType: Confluence["type"] = "bullish",
): ConfluenceSource {
  return {
    id:
      overrides.id ??
      buildConfluenceSourceId(
        channelType,
        fallbackIndex === undefined ? undefined : `legacy-${fallbackIndex}`,
      ),
    channel_type: channelType,
    selection:
      overrides.selection
      ?? getDefaultConfluenceSelection(channelType, confluenceType, fallbackIndex ?? 0),
    length: Math.max(
      2,
      Number(overrides.length) || getDefaultChannelLength(channelType),
    ),
    width_coeff: overrides.width_coeff ?? null,
    upper_dev: overrides.upper_dev ?? null,
    lower_dev: overrides.lower_dev ?? null,
    window_type: overrides.window_type ?? null,
    interval_step:
      overrides.interval_step == null
        ? null
        : Math.max(1, Number(overrides.interval_step) || 1),
  };
}

export function normalizeConfluenceConfig(confluence: Confluence | null): Confluence | null {
  if (!confluence) {
    return null;
  }

  const normalizedType =
    confluence.type === "bullish"
    || confluence.type === "bearish"
    || confluence.type === "breakout"
    || confluence.type === "any"
      ? confluence.type
      : confluence.type === "role_reversal"
        ? "breakout"
      : "bullish";

  const fallbackChannelTypes: ChannelType[] =
    Array.isArray(confluence.channels) && confluence.channels.length > 0
      ? confluence.channels.slice(0, 2)
      : ["trend", "lrc"];

  const rawSources =
    Array.isArray(confluence.sources) && confluence.sources.length > 0
      ? confluence.sources
      : fallbackChannelTypes.map((channelType, index) =>
          createConfluenceSource(channelType, {}, index, normalizedType),
        );

  const sources = rawSources.slice(0, 2).map((source, index) => {
    const channelType = source.channel_type ?? confluence.channels?.[index] ?? "lrc";
    return createConfluenceSource(channelType, source, index, normalizedType);
  });

  while (sources.length < 2) {
    const fallbackIndex = sources.length;
    const fallbackChannelType = fallbackChannelTypes[fallbackIndex] ?? "lrc";
    sources.push(
      createConfluenceSource(
        fallbackChannelType,
        {},
        fallbackIndex,
        normalizedType,
      ),
    );
  }

  return {
    ...confluence,
    type: normalizedType,
    sources,
    channels: sources.map((source) => source.channel_type),
    liquidity_sweep: Boolean(confluence.liquidity_sweep),
    lookback_candles: Math.min(
      4,
      Math.max(1, Number(confluence.lookback_candles) || 4),
    ),
    tolerance_pct: Number.isFinite(Number(confluence.tolerance_pct))
      ? Number(confluence.tolerance_pct)
      : 0.1,
  };
}
