import { useState, useCallback, useEffect } from "react";
import type {
  AssetType,
  CryptoExchangeOption,
  CryptoExchangeOptionsResponse,
  TimeframeMode,
  ComplianceStatus,
  IndicatorConfig,
  ChannelRespect,
  Confluence,
  PriceRange,
  ScanStage,
  ScreenerDetailRequest,
  ScreenerDetailResponse,
  ScreenerRequest,
  ScreenerResult,
  ScreenerResultDetail
} from "@/types/screener";
import { normalizeConfluenceConfig, normalizeIndicatorConfig } from "@/types/screener";
import type { FilterSnapshot } from "@/hooks/useUserSettings";
import { appEnv } from "@/config/env";

const API_BASE = appEnv.apiBase;
const NETWORK_ERROR_MESSAGES = [
  "failed to fetch",
  "networkerror",
  "load failed",
  "network request failed",
];

const VALID_INDICATOR_NAMES = new Set([
  "rsi",
  "wavetrend",
  "aroon",
  "lrc",
  "regression",
  "trend",
  "linreg_candles",
  "ema",
  "macd",
  "volume",
  "relative_volume",
  "current_volume",
  "float",
  "shares_outstanding",
  "volatility",
]);

interface ResultContext {
  request: ScreenerRequest;
  stage: ScanStage;
  timeframe: string;
}

function runtimeApiBase(): string {
  const override = localStorage.getItem("screener.apiBaseOverride")?.trim();
  const base = override || API_BASE;
  return base.replace(/\/+$/, "");
}

function runtimeTimeoutMs(): number {
  const parsed = Number(localStorage.getItem("screener.apiTimeoutMs") || "");
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 120000;
}

function runtimeRetries(): number {
  const parsed = Number(localStorage.getItem("screener.apiRetries") || "");
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function isBackendUnavailable(error: unknown) {
  if (error instanceof TypeError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return NETWORK_ERROR_MESSAGES.some((fragment) => message.includes(fragment));
}

function shouldUseFallbackData(error: unknown) {
  return isBackendUnavailable(error);
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("aborterror") || message.includes("aborted");
}

function timeframeToSeconds(value: string): number | null {
  const lowered = String(value || "").trim().toLowerCase();
  const fixed: Record<string, number> = {
    "1m": 60,
    "5m": 5 * 60,
    "15m": 15 * 60,
    "30m": 30 * 60,
    "1h": 60 * 60,
    "4h": 4 * 60 * 60,
    "1day": 24 * 60 * 60,
  };

  if (fixed[lowered]) {
    return fixed[lowered];
  }

  const match = lowered.match(/^(\d+)\s*(m|h|d|w|mo|day)$/);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2] === "day" ? "d" : match[2];
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  if (unit === "d") return amount * 24 * 60 * 60;
  if (unit === "w") return amount * 7 * 24 * 60 * 60;
  return amount * 30 * 24 * 60 * 60;
}

function normalizeCryptoExchangeSelection(
  values: string[] | null | undefined,
  availableExchanges: string[] = [],
): string[] {
  const normalized = Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ).sort();

  if (!normalized.length) {
    return [];
  }

  if (
    availableExchanges.length
    && availableExchanges.every((exchange) => normalized.includes(exchange))
  ) {
    return [];
  }

  return normalized;
}

function cryptoExchangeNames(options: CryptoExchangeOption[]): string[] {
  return options.map((option) => option.exchange);
}

function buildSampleResults(
  assetType: AssetType,
  timeframe: string,
  mode: TimeframeMode,
  stage: ScanStage,
): ScreenerResult[] {
  const stockRows: ScreenerResult[] = [
    {
      symbol: "AAPL",
      price: 223.41,
      asset_type: "stocks",
      data_source: "zoya",
      exchange: "NASDAQ",
      name: "Apple Inc.",
      timeframe,
      stickers: ["RSI (14) | Oversold Turning Up | No Pattern | Last 1 Candle", "EMA (200) | Above | No Pattern | Last 1 Candle", "Volume (20) | Spike x2 | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "MSFT",
      price: 478.62,
      asset_type: "stocks",
      data_source: "zoya",
      exchange: "NASDAQ",
      name: "Microsoft Corp.",
      timeframe,
      stickers: ["MACD | Bullish Cross | No Pattern | Last 1 Candle", "Regression Channel (200) | Middle Line: Wick Touch | No Pattern | Last 1 Candle", "Volatility (20) | 1.12% | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "NVDA",
      price: 1043.77,
      asset_type: "stocks",
      data_source: "zoya",
      exchange: "NASDAQ",
      name: "NVIDIA Corp.",
      timeframe,
      stickers: ["WaveTrend (21) | Oversold Crossed Up | No Pattern | Last 1 Candle", "LRC (100) | Lower Line: Wick Touch | No Pattern | Last 1 Candle", "Confluence | Bullish Alignment | No Pattern | Last 2 Candles"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "AMZN",
      price: 201.84,
      asset_type: "stocks",
      data_source: "zoya",
      exchange: "NASDAQ",
      name: "Amazon.com Inc.",
      timeframe,
      stickers: ["RSI (14) | Neutral Turning Up | No Pattern | Last 1 Candle", "EMA (200) | Above | No Pattern | Last 1 Candle", "Current Volume | Value 120,000 | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "META",
      price: 618.29,
      asset_type: "stocks",
      data_source: "zoya",
      exchange: "NASDAQ",
      name: "Meta Platforms Inc.",
      timeframe,
      stickers: ["MACD | Above Zero | No Pattern | Last 1 Candle", "Trend Channel (8) | Top Zone: Rejected from Zone | No Pattern | Last 1 Candle", "Relative Volume (20) | Ratio x1.80 | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "TSLA",
      price: 264.73,
      asset_type: "stocks",
      data_source: "zoya",
      exchange: "NASDAQ",
      name: "Tesla Inc.",
      timeframe,
      stickers: ["LinReg Candles (11) | Above Close Above | No Pattern | Last 1 Candle", "Volume (20) | Spike x2 | No Pattern | Last 1 Candle", "Confluence | Role Reversal Alignment | No Pattern | Last 2 Candles"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "JPM",
      price: 236.18,
      asset_type: "stocks",
      data_source: "zoya",
      exchange: "NYSE",
      name: "JPMorgan Chase & Co.",
      timeframe,
      stickers: ["Aroon (14) | Above +50 Rising | No Pattern | Last 1 Candle", "EMA (200) | Above | No Pattern | Last 1 Candle", "Volatility (20) | 0.78% | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "XOM",
      price: 121.45,
      asset_type: "stocks",
      data_source: "zoya",
      exchange: "NYSE",
      name: "Exxon Mobil Corp.",
      timeframe,
      stickers: ["WaveTrend (21) | Neutral Rising | No Pattern | Last 1 Candle", "Regression Channel (200) | Middle Line: Wick Touch | No Pattern | Last 1 Candle", "Current Volume | Value 88,000 | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
  ];

  const cryptoRows: ScreenerResult[] = [
    {
      symbol: "BTC-USD",
      price: 102845.72,
      asset_type: "crypto",
      data_source: "coinmarketcap",
      exchange: "binance,coinbase,kucoin",
      exchange_availability: ["binance", "coinbase", "kucoin", "bitstamp", "mexc"],
      name: "Bitcoin",
      timeframe,
      stickers: ["RSI (14) | Neutral Turning Up | No Pattern | Last 1 Candle", "Trend Channel (8) | Middle Line: Touched | No Pattern | Last 1 Candle", "Relative Volume (20) | Ratio x1.60 | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "ETH-USD",
      price: 5412.33,
      asset_type: "crypto",
      data_source: "coinmarketcap",
      exchange: "binance,coinbase,kucoin",
      exchange_availability: ["binance", "coinbase", "kucoin", "bitstamp", "mexc"],
      name: "Ethereum",
      timeframe,
      stickers: ["MACD | Bullish Cross | No Pattern | Last 1 Candle", "Confluence | Role Reversal Alignment | No Pattern | Last 2 Candles", "EMA (200) | Above | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "SOL-USD",
      price: 312.86,
      asset_type: "crypto",
      data_source: "coinmarketcap",
      exchange: "binance,coinbase,mexc",
      exchange_availability: ["binance", "coinbase", "mexc", "kucoin"],
      name: "Solana",
      timeframe,
      stickers: ["WaveTrend (21) | Oversold Turning Up | No Pattern | Last 1 Candle", "Channel Respect | Trend Both 3 Touches | No Pattern | Last 120 Candles", "Confluence | Bullish Alignment | No Pattern | Last 2 Candles"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "BNB-USD",
      price: 819.44,
      asset_type: "crypto",
      data_source: "coinmarketcap",
      exchange: "binance,kucoin,mexc",
      exchange_availability: ["binance", "kucoin", "mexc", "bitmart"],
      name: "BNB",
      timeframe,
      stickers: ["Aroon (14) | Above +50 Rising | No Pattern | Last 1 Candle", "LRC (100) | Lower Line: Wick Touch | No Pattern | Last 1 Candle", "Current Volume | Value 340,000 | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "XRP-USD",
      price: 2.87,
      asset_type: "crypto",
      data_source: "coinmarketcap",
      exchange: "binance,coinbase,bitstamp",
      exchange_availability: ["binance", "coinbase", "bitstamp", "kucoin"],
      name: "XRP",
      timeframe,
      stickers: ["RSI (14) | Overbought Turning Down | No Pattern | Last 1 Candle", "EMA (200) | Above | No Pattern | Last 1 Candle", "Volatility (20) | 2.04% | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "ADA-USD",
      price: 1.42,
      asset_type: "crypto",
      data_source: "coinmarketcap",
      exchange: "binance,coinbase,kucoin",
      exchange_availability: ["binance", "coinbase", "kucoin", "mexc"],
      name: "Cardano",
      timeframe,
      stickers: ["WaveTrend (21) | Oversold Crossed Up | No Pattern | Last 1 Candle", "LinReg Candles (11) | Above Close Above | No Pattern | Last 1 Candle", "Relative Volume (20) | Ratio x1.40 | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "DOGE-USD",
      price: 0.61,
      asset_type: "crypto",
      data_source: "coinmarketcap",
      exchange: "binance,coinbase,bitmart",
      exchange_availability: ["binance", "coinbase", "bitmart", "kucoin", "mexc"],
      name: "Dogecoin",
      timeframe,
      stickers: ["MACD | Above Zero | No Pattern | Last 1 Candle", "Volume (20) | Spike x2 | No Pattern | Last 1 Candle", "Confluence | Role Reversal Alignment | No Pattern | Last 2 Candles"],
      note: "Sample data shown while backend is unavailable.",
    },
    {
      symbol: "LINK-USD",
      price: 41.22,
      asset_type: "crypto",
      data_source: "coinmarketcap",
      exchange: "binance,coinbase,bitstamp",
      exchange_availability: ["binance", "coinbase", "bitstamp", "kucoin"],
      name: "Chainlink",
      timeframe,
      stickers: ["Regression Channel (200) | Middle Line: Wick Touch | No Pattern | Last 1 Candle", "EMA (200) | Above | No Pattern | Last 1 Candle", "Current Volume | Value 56,000 | No Pattern | Last 1 Candle"],
      note: "Sample data shown while backend is unavailable.",
    },
  ];

  const rows = assetType === "crypto" ? cryptoRows : stockRows;

  if (mode === "gate_entry") {
    return rows.map((row, index) => ({
      ...row,
      scan_stage: stage,
      stickers: row.stickers.slice(0, index === 0 ? 3 : 2),
    }));
  }

  return rows.map((row) => ({
    ...row,
    scan_stage: stage,
  }));
}

function applySampleResults(
  assetType: AssetType,
  timeframe: string,
  mode: TimeframeMode,
  stage: "single" | "gate" | "entry",
) {
  const sampleResults = buildSampleResults(assetType, timeframe, mode, stage);
  const count = sampleResults.length;

  switch (stage) {
    case "gate":
      return {
        results: sampleResults,
        gateCompleted: true,
        gateCount: count,
        entryCompleted: false,
        entryCount: 0,
        statusMessage: `Backend unavailable. Showing ${count} sample gate results instead.`,
      };
    case "entry":
      return {
        results: sampleResults,
        gateCompleted: true,
        gateCount: count,
        entryCompleted: true,
        entryCount: count,
        statusMessage: `Backend unavailable. Showing ${count} sample entry results instead.`,
      };
    default:
      return {
        results: sampleResults,
        gateCompleted: false,
        gateCount: 0,
        entryCompleted: false,
        entryCount: 0,
        statusMessage: `Backend unavailable. Showing ${count} sample results instead.`,
      };
  }
}

export function useScreener() {

  // -------------------------------------------------------
  // FILTER STATE
  // -------------------------------------------------------

  const [assetType, setAssetType] = useState<AssetType>("stocks");

  const [complianceStatus, setComplianceStatus] =
    useState<ComplianceStatus | null>(null);

  const [complianceStandards, setComplianceStandards] =
    useState<string[]>([]);

  const [excludedCategories, setExcludedCategories] =
    useState<string[]>([]);
  const [cryptoExchanges, setCryptoExchanges] =
    useState<string[]>([]);
  const [availableCryptoExchanges, setAvailableCryptoExchanges] =
    useState<CryptoExchangeOption[]>([]);
  const [cryptoExchangeOptionsLoading, setCryptoExchangeOptionsLoading] =
    useState(false);

  const [timeframeMode, setTimeframeMode] =
    useState<TimeframeMode>("single");

  const [singleTimeframe, setSingleTimeframe] =
    useState<string>("1day");

  const [gateTimeframe, setGateTimeframe] =
    useState<string>("1day");

  const [entryTimeframe, setEntryTimeframe] =
    useState<string>("4h");

  const [indicators, setIndicators] =
    useState<IndicatorConfig[]>([]);

  const [channelRespect, setChannelRespect] =
    useState<ChannelRespect | null>(null);

  const [confluence, setConfluence] =
    useState<Confluence | null>(null);

  const [priceRange, setPriceRange] =
    useState<PriceRange | null>(null);


  // -------------------------------------------------------
  // RESULT STATE
  // -------------------------------------------------------

  const [results, setResults] =
    useState<ScreenerResult[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [statusMessage, setStatusMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [gateCompleted, setGateCompleted] =
    useState(false);

  const [entryCompleted, setEntryCompleted] =
    useState(false);

  const [gateCount, setGateCount] =
    useState(0);

  const [entryCount, setEntryCount] =
    useState(0);
  const [gateSessionId, setGateSessionId] =
    useState<string | null>(null);
  const [lastResultContext, setLastResultContext] =
    useState<ResultContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCryptoExchangeOptions = async () => {
      setCryptoExchangeOptionsLoading(true);

      try {
        const response = await fetch(`${runtimeApiBase()}/crypto-exchanges`);
        if (!response.ok) {
          throw new Error("Failed to load crypto exchange options.");
        }

        const data = await response.json() as CryptoExchangeOptionsResponse;
        if (!cancelled) {
          setAvailableCryptoExchanges(
            data.exchanges
              .map((option) => ({
                exchange: String(option.exchange || "").trim().toLowerCase(),
                coin_count: Number.isFinite(option.coin_count) ? option.coin_count : 0,
              }))
              .filter((option) => option.exchange)
              .sort((left, right) => left.exchange.localeCompare(right.exchange)),
          );
        }
      } catch (error) {
        console.error("Failed to load crypto exchange options:", error);
      } finally {
        if (!cancelled) {
          setCryptoExchangeOptionsLoading(false);
        }
      }
    };

    loadCryptoExchangeOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  function buildRequestSnapshot(): ScreenerRequest {
    const safeIndicators = sanitizeIndicators(indicators);
    const safeConfluence = normalizeConfluenceConfig(confluence);
    const normalizedCryptoExchanges = normalizeCryptoExchangeSelection(
      cryptoExchanges,
      cryptoExchangeNames(availableCryptoExchanges),
    );

    const safeChannelRespect = channelRespect
      ? {
          ...channelRespect,
          line: channelRespect.line ?? "middle",
          cluster_gap: Math.min(5, Math.max(3, channelRespect.cluster_gap ?? 3)),
        }
      : null;

    return {
      asset_type: assetType,
      stock_sources: assetType === "stocks"
        ? ["zoya"]
        : null,
      exchanges: assetType === "crypto"
        ? (normalizedCryptoExchanges.length ? normalizedCryptoExchanges : null)
        : null,
      compliance_status: assetType === "stocks"
        ? complianceStatus
        : null,
      compliance_standards: null,
      excluded_categories: assetType === "crypto"
        ? (excludedCategories.length
          ? excludedCategories
          : null)
        : null,
      timeframe_mode: timeframeMode,
      single_timeframe: timeframeMode === "single"
        ? singleTimeframe
        : null,
      gate_timeframe: timeframeMode === "gate_entry"
        ? gateTimeframe
        : null,
      entry_timeframe: timeframeMode === "gate_entry"
        ? entryTimeframe
        : null,
      gate_session_id: null,
      indicators: safeIndicators,
      channel_respect: safeChannelRespect,
      confluence:
        safeConfluence && (safeConfluence.sources?.length ?? 0) >= 2
          ? safeConfluence
          : null,
      price_range: priceRange,
    };
  }

  const setFallbackResults = useCallback((
    stage: "single" | "gate" | "entry",
    timeframeOverride?: string,
  ) => {
    const request = buildRequestSnapshot();
    const timeframe = timeframeOverride ?? (timeframeMode === "single" ? singleTimeframe : entryTimeframe);
    const fallback = applySampleResults(
      assetType,
      timeframe,
      timeframeMode,
      stage,
    );

    setResults(fallback.results);
    setGateCompleted(fallback.gateCompleted);
    setGateCount(fallback.gateCount);
    setEntryCompleted(fallback.entryCompleted);
    setEntryCount(fallback.entryCount);
    setStatusMessage(fallback.statusMessage);
    setErrorMessage("");
    setGateSessionId(stage === "single" ? null : "sample-session");
    setLastResultContext({
      request,
      stage,
      timeframe,
    });
  }, [assetType, entryTimeframe, singleTimeframe, timeframeMode]);


  // -------------------------------------------------------
  // RESET
  // -------------------------------------------------------

  const resetGateEntry = useCallback(() => {
    setGateCompleted(false);
    setEntryCompleted(false);
    setGateSessionId(null);
    setStatusMessage("");
    setErrorMessage("");
  }, []);

  const normalizeGateEntryPair = useCallback((gate: string, entry: string) => {
    const gateSeconds = timeframeToSeconds(gate);
    const entrySeconds = timeframeToSeconds(entry);

    if (
      gateSeconds !== null
      && entrySeconds !== null
      && gateSeconds < entrySeconds
    ) {
      return {
        gate: entry,
        entry: gate,
      };
    }

    return { gate, entry };
  }, []);

  const sanitizeIndicators = useCallback(
    (nextIndicators: IndicatorConfig[]): IndicatorConfig[] =>
      nextIndicators
        .filter((indicator) => VALID_INDICATOR_NAMES.has(indicator.name))
        .map(normalizeIndicatorConfig),
    [],
  );


  // -------------------------------------------------------
  // SNAPSHOT
  // -------------------------------------------------------

  const getSnapshot = useCallback((): FilterSnapshot => ({
    assetType,
    complianceStatus,
    complianceStandards,
    excludedCategories,
    cryptoExchanges: normalizeCryptoExchangeSelection(
      cryptoExchanges,
      cryptoExchangeNames(availableCryptoExchanges),
    ),
    timeframeMode,
    singleTimeframe,
    gateTimeframe,
    entryTimeframe,
    indicators,
    channelRespect,
    confluence,
    priceRange,
  }), [
    assetType,
    complianceStatus,
    complianceStandards,
    excludedCategories,
    cryptoExchanges,
    availableCryptoExchanges,
    timeframeMode,
    singleTimeframe,
    gateTimeframe,
    entryTimeframe,
    indicators,
    channelRespect,
    confluence,
    priceRange,
  ]);


  const loadSnapshot = useCallback((snap: FilterSnapshot) => {

    setAssetType(snap.assetType);
    setComplianceStatus(snap.complianceStatus);
    setComplianceStandards(snap.complianceStandards);
    setExcludedCategories(snap.excludedCategories);
    setCryptoExchanges(
      normalizeCryptoExchangeSelection(
        snap.cryptoExchanges,
        cryptoExchangeNames(availableCryptoExchanges),
      ),
    );
    setTimeframeMode(snap.timeframeMode);
    setSingleTimeframe(snap.singleTimeframe);
    const normalizedPair = normalizeGateEntryPair(snap.gateTimeframe, snap.entryTimeframe);
    setGateTimeframe(normalizedPair.gate);
    setEntryTimeframe(normalizedPair.entry);
    setIndicators(sanitizeIndicators(snap.indicators));
    setChannelRespect(snap.channelRespect);
    setConfluence(normalizeConfluenceConfig(snap.confluence));
    setPriceRange(snap.priceRange ?? null);

    resetGateEntry();
    setResults([]);
    setLastResultContext(null);

  }, [availableCryptoExchanges, normalizeGateEntryPair, resetGateEntry, sanitizeIndicators]);


  // -------------------------------------------------------
  // BUILD REQUEST
  // -------------------------------------------------------

  const buildRequest = useCallback((): ScreenerRequest => {
    return buildRequestSnapshot();
  }, [
    assetType,
    complianceStatus,
    complianceStandards,
    excludedCategories,
    cryptoExchanges,
    availableCryptoExchanges,
    timeframeMode,
    singleTimeframe,
    gateTimeframe,
    entryTimeframe,
    indicators,
    channelRespect,
    confluence,
    priceRange,
    sanitizeIndicators
  ]);


  // -------------------------------------------------------
  // API CALL
  // -------------------------------------------------------

  const callAPI = async <T>(
    endpoint: string,
    body: ScreenerRequest | ScreenerDetailRequest
  ): Promise<T> => {
    const base = runtimeApiBase();
    const timeoutMs = runtimeTimeoutMs();
    const retries = runtimeRetries();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(`${base}/${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          let message = "Backend error";

          try {
            const errorData = await res.json();
            if (typeof errorData?.detail === "string") {
              message = errorData.detail;
            } else if (Array.isArray(errorData?.detail) && errorData.detail.length > 0) {
              const first = errorData.detail[0];
              if (typeof first?.msg === "string") {
                message = first.msg;
              }
            }
          } catch {
            // Ignore JSON parse failures and fall back to the default message.
          }

          throw new Error(message);
        }

        return res.json() as Promise<T>;
      } catch (error) {
        if (isAbortError(error)) {
          const timeoutSeconds = Math.max(1, Math.round(timeoutMs / 1000));
          lastError = new Error(
            `Request timed out after ${timeoutSeconds}s. Increase timeout in Settings > API Control.`
          );
        } else {
          lastError = error instanceof Error ? error : new Error("Request failed");
        }
        if (attempt >= retries) {
          break;
        }
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    throw lastError ?? new Error("Request failed");

  };

  const validateGateEntryTimeframes = useCallback(() => {
    const gateSeconds = timeframeToSeconds(gateTimeframe);
    const entrySeconds = timeframeToSeconds(entryTimeframe);

    if (
      gateSeconds !== null
      && entrySeconds !== null
      && gateSeconds <= entrySeconds
    ) {
      throw new Error("Gate timeframe must be larger than entry timeframe.");
    }
  }, [entryTimeframe, gateTimeframe]);

  const buildGateBody = useCallback(() => {
    const body = buildRequest();
    body.timeframe_mode = "gate_entry";
    body.indicators = body.indicators.filter(
      i => i.timeframe === "primary"
    );
    return body;
  }, [buildRequest]);

  const buildEntryBody = useCallback((sessionId: string) => {
    const body = buildRequest();
    body.timeframe_mode = "gate_entry";
    body.indicators = body.indicators.filter(
      i => i.timeframe === "secondary"
    );
    body.gate_session_id = sessionId;
    return body;
  }, [buildRequest]);


  // -------------------------------------------------------
  // SINGLE SCAN
  // -------------------------------------------------------

  const runSingle = useCallback(async () => {

    setLoading(true);
    setErrorMessage("");

    try {

      const body = buildRequest();
      body.timeframe_mode = "single";

      const data = await callAPI<{ results?: ScreenerResult[] }>("run", body);

      setResults(data.results || []);
      setLastResultContext({
        request: body,
        stage: "single",
        timeframe: body.single_timeframe || singleTimeframe,
      });

      setStatusMessage(
        `Screening completed. ${data.results?.length || 0} assets found.`
      );

    } catch (e) {
      if (shouldUseFallbackData(e)) {
        setFallbackResults("single", singleTimeframe);
      } else {
        setErrorMessage(e instanceof Error ? e.message : "Backend unavailable");
      }

    } finally {

      setLoading(false);

    }

  }, [buildRequest, setFallbackResults, singleTimeframe]);


  // -------------------------------------------------------
  // GATE
  // -------------------------------------------------------

  const runGate = useCallback(async () => {

    setLoading(true);
    setErrorMessage("");
    setEntryCompleted(false);

    try {
      validateGateEntryTimeframes();
      const body = buildGateBody();

      const data = await callAPI<{ results?: ScreenerResult[]; gate_session_id?: string | null }>("run-gate", body);

      const count = data.results?.length || 0;
      const sessionId = data.gate_session_id ?? null;

      setGateCompleted(true);
      setGateCount(count);
      setGateSessionId(sessionId);
      setResults(data.results || []);
      setLastResultContext({
        request: body,
        stage: "gate",
        timeframe: body.gate_timeframe || gateTimeframe,
      });

      setStatusMessage(
        `Gate completed. ${count} symbols passed.`
      );

    } catch (e) {
      if (shouldUseFallbackData(e)) {
        setFallbackResults("gate", gateTimeframe);
      } else {
        setErrorMessage(e instanceof Error ? e.message : "Gate scan failed");
      }

    } finally {

      setLoading(false);

    }

  }, [buildGateBody, callAPI, gateTimeframe, setFallbackResults, validateGateEntryTimeframes]);


  // -------------------------------------------------------
  // ENTRY
  // -------------------------------------------------------

  const runEntry = useCallback(async () => {

    if (!gateCompleted || !gateSessionId) {
      setErrorMessage("Run Gate before Entry.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      validateGateEntryTimeframes();
      const body = buildEntryBody(gateSessionId);
      const data = await callAPI<{ results?: ScreenerResult[] }>("run-entry", body);

      const count = data.results?.length || 0;

      setEntryCompleted(true);
      setEntryCount(count);
      setResults(data.results || []);
      setLastResultContext({
        request: body,
        stage: "entry",
        timeframe: body.entry_timeframe || entryTimeframe,
      });

      setStatusMessage(
        `Entry completed. ${count} final symbols.`
      );

    } catch (e) {
      if (shouldUseFallbackData(e)) {
        setFallbackResults("entry", entryTimeframe);
      } else {
        setErrorMessage(e instanceof Error ? e.message : "Entry scan failed");
      }

    } finally {

      setLoading(false);

    }

  }, [
    gateCompleted,
    gateSessionId,
    buildEntryBody,
    callAPI,
    entryTimeframe,
    setFallbackResults,
    validateGateEntryTimeframes,
  ]);

  const runGateEntry = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    setEntryCompleted(false);

    try {
      validateGateEntryTimeframes();

      const gateBody = buildGateBody();
      const gateData = await callAPI<{ results?: ScreenerResult[]; gate_session_id?: string | null }>("run-gate", gateBody);
      const gateResults = gateData.results || [];
      const gateSession = gateData.gate_session_id ?? null;
      const gateResultsCount = gateResults.length;

      setGateCompleted(true);
      setGateCount(gateResultsCount);
      setGateSessionId(gateSession);
      setResults(gateResults);
      setLastResultContext({
        request: gateBody,
        stage: "gate",
        timeframe: gateBody.gate_timeframe || gateTimeframe,
      });

      if (!gateSession || gateResultsCount === 0) {
        setEntryCompleted(true);
        setEntryCount(0);
        setStatusMessage(`Gate completed. ${gateResultsCount} symbols passed. Entry skipped.`);
        return;
      }

      const entryBody = buildEntryBody(gateSession);
      const entryData = await callAPI<{ results?: ScreenerResult[] }>("run-entry", entryBody);
      const entryResults = entryData.results || [];
      const entryResultsCount = entryResults.length;

      setEntryCompleted(true);
      setEntryCount(entryResultsCount);
      setResults(entryResults);
      setLastResultContext({
        request: entryBody,
        stage: "entry",
        timeframe: entryBody.entry_timeframe || entryTimeframe,
      });
      setStatusMessage(`Gate completed (${gateResultsCount}) -> Entry completed (${entryResultsCount}).`);
    } catch (e) {
      if (shouldUseFallbackData(e)) {
        setFallbackResults("entry", entryTimeframe);
      } else {
        setErrorMessage(e instanceof Error ? e.message : "Gate-entry scan failed");
      }
    } finally {
      setLoading(false);
    }
  }, [
    buildEntryBody,
    buildGateBody,
    callAPI,
    entryTimeframe,
    setFallbackResults,
    validateGateEntryTimeframes,
  ]);

  const fetchResultDetail = useCallback(async (result: ScreenerResult): Promise<ScreenerResultDetail> => {
    const context = lastResultContext ?? {
      request: buildRequest(),
      stage: (result.scan_stage || "single") as ScanStage,
      timeframe: result.timeframe,
    };

    const body: ScreenerDetailRequest = {
      symbol: result.symbol,
      asset_type: result.asset_type,
      timeframe: result.timeframe || context.timeframe,
      scan_stage: (result.scan_stage || context.stage || "single") as ScanStage,
      request: context.request,
    };

    const data = await callAPI<ScreenerDetailResponse>("details", body);

    if (!data.detail) {
      throw new Error("Asset detail unavailable.");
    }

    return data.detail;
  }, [buildRequest, callAPI, lastResultContext]);


  // -------------------------------------------------------
  // RETURN
  // -------------------------------------------------------

  return {

    assetType,
    setAssetType: (v: AssetType) => {
      setAssetType(v);
      resetGateEntry();
    },

    complianceStatus,
    setComplianceStatus: (v: ComplianceStatus | null) => {
      setComplianceStatus(v);
      resetGateEntry();
    },

    complianceStandards,
    setComplianceStandards: (v: string[]) => {
      setComplianceStandards(v);
      resetGateEntry();
    },

    excludedCategories,
    setExcludedCategories: (v: string[]) => {
      setExcludedCategories(v);
      resetGateEntry();
    },
    availableCryptoExchanges,
    cryptoExchangeOptionsLoading,
    cryptoExchanges,
    setCryptoExchanges: (v: string[]) => {
      setCryptoExchanges(
        normalizeCryptoExchangeSelection(v, cryptoExchangeNames(availableCryptoExchanges)),
      );
      resetGateEntry();
    },

    timeframeMode,
    setTimeframeMode: (v: TimeframeMode) => {
      setTimeframeMode(v);
      if (v === "gate_entry") {
        const normalizedPair = normalizeGateEntryPair(gateTimeframe, entryTimeframe);
        setGateTimeframe(normalizedPair.gate);
        setEntryTimeframe(normalizedPair.entry);
      }
      resetGateEntry();
    },

    singleTimeframe,
    setSingleTimeframe: (v: string) => {
      setSingleTimeframe(v);
      resetGateEntry();
    },

    gateTimeframe,
    setGateTimeframe: (v: string) => {
      const normalizedPair = normalizeGateEntryPair(v, entryTimeframe);
      setGateTimeframe(normalizedPair.gate);
      setEntryTimeframe(normalizedPair.entry);
      resetGateEntry();
    },

    entryTimeframe,
    setEntryTimeframe: (v: string) => {
      const normalizedPair = normalizeGateEntryPair(gateTimeframe, v);
      setGateTimeframe(normalizedPair.gate);
      setEntryTimeframe(normalizedPair.entry);
      resetGateEntry();
    },

    indicators,
    setIndicators: (v: IndicatorConfig[]) => {
      setIndicators(sanitizeIndicators(v));
      resetGateEntry();
    },

    channelRespect,
    setChannelRespect: (v: ChannelRespect | null) => {
      setChannelRespect(v);
      resetGateEntry();
    },

    confluence,
    setConfluence: (v: Confluence | null) => {
      setConfluence(normalizeConfluenceConfig(v));
      resetGateEntry();
    },

    priceRange,
    setPriceRange: (v: PriceRange | null) => {
      setPriceRange(v);
      resetGateEntry();
    },

    results,
    loading,

    gateCompleted,
    gateCount,

    entryCompleted,
    entryCount,

    statusMessage,
    errorMessage,

    runSingle,
    runGate,
    runEntry,
    runGateEntry,
    fetchResultDetail,

    getSnapshot,
    loadSnapshot

  };
}
