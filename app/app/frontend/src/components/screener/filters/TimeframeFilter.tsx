import { useEffect, useMemo, useState } from "react";
import type { TimeframeMode } from "@/types/screener";
import { TIMEFRAMES } from "@/types/screener";

interface Props {
  mode: TimeframeMode;
  onModeChange: (v: TimeframeMode) => void;
  singleTimeframe: string;
  onSingleChange: (v: string) => void;
  gateTimeframe: string;
  onGateChange: (v: string) => void;
  entryTimeframe: string;
  onEntryChange: (v: string) => void;
}

export function TimeframeFilter({ mode, onModeChange, singleTimeframe, onSingleChange, gateTimeframe, onGateChange, entryTimeframe, onEntryChange }: Props) {
  const parseCustom = (value: string) => {
    const match = String(value).trim().toLowerCase().match(/^(\d+)\s*(m|h|d|w|mo|day)$/);
    if (!match) return { amount: 15, unit: "m" };
    const parsedUnit = match[2] === "day" ? "d" : match[2];
    return { amount: Number(match[1]) || 15, unit: parsedUnit };
  };

  const singleCustom = useMemo(() => parseCustom(singleTimeframe), [singleTimeframe]);
  const gateCustom = useMemo(() => parseCustom(gateTimeframe), [gateTimeframe]);
  const entryCustom = useMemo(() => parseCustom(entryTimeframe), [entryTimeframe]);

  const [singleAmount, setSingleAmount] = useState(String(singleCustom.amount));
  const [singleUnit, setSingleUnit] = useState(singleCustom.unit);
  const [gateAmount, setGateAmount] = useState(String(gateCustom.amount));
  const [gateUnit, setGateUnit] = useState(gateCustom.unit);
  const [entryAmount, setEntryAmount] = useState(String(entryCustom.amount));
  const [entryUnit, setEntryUnit] = useState(entryCustom.unit);

  useEffect(() => {
    setSingleAmount(String(singleCustom.amount));
    setSingleUnit(singleCustom.unit);
  }, [singleCustom.amount, singleCustom.unit]);

  useEffect(() => {
    setGateAmount(String(gateCustom.amount));
    setGateUnit(gateCustom.unit);
  }, [gateCustom.amount, gateCustom.unit]);

  useEffect(() => {
    setEntryAmount(String(entryCustom.amount));
    setEntryUnit(entryCustom.unit);
  }, [entryCustom.amount, entryCustom.unit]);

  const tfWithCustom = [...TIMEFRAMES, "custom"];
  const formatCustom = (amountRaw: string, unit: string) => {
    const parsed = Number.parseInt(amountRaw, 10);
    const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    const compact = `${normalized}${unit}`;
    // Keep custom selections visually in "Custom" mode even when they match preset keys like 1m/5m.
    
    return TIMEFRAMES.includes(compact) ? `${normalized} ${unit}` : compact;
  };
  const commitAmount = (
    amountRaw: string,
    unit: string,
    setAmount: (next: string) => void,
    commit: (value: string) => void,
  ) => {
    const parsed = Number.parseInt(amountRaw, 10);
    const normalized = Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "1";
    setAmount(normalized);
    commit(formatCustom(normalized, unit));
  };
  const isPreset = (value: string) => TIMEFRAMES.includes(value);

  const singleSelectValue = isPreset(singleTimeframe) ? singleTimeframe : "custom";
  const gateSelectValue = isPreset(gateTimeframe) ? gateTimeframe : "custom";
  const entrySelectValue = isPreset(entryTimeframe) ? entryTimeframe : "custom";

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Timeframe</label>
      <div className="flex gap-2">
        {([
          { label: "Single", value: "single" as TimeframeMode },
          { label: "Gate → Entry", value: "gate_entry" as TimeframeMode },
        ]).map((opt) => (
          <button
            key={opt.value}
            onClick={() => onModeChange(opt.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {mode === "single" ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Timeframe</div>
            <select
              value={singleSelectValue}
              onChange={e => onSingleChange(e.target.value === "custom" ? formatCustom(singleAmount, singleUnit) : e.target.value)}
              className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
            >
              {tfWithCustom.map(tf => <option key={tf} value={tf}>{tf === "custom" ? "Custom" : tf}</option>)}
            </select>
            {singleSelectValue === "custom" && (
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={singleAmount}
                  onChange={(e) => {
                    const amount = e.target.value;
                    setSingleAmount(amount);
                    if (/^\d+$/.test(amount)) {
                      onSingleChange(formatCustom(amount, singleUnit));
                    }
                  }}
                  onBlur={() => commitAmount(singleAmount, singleUnit, setSingleAmount, onSingleChange)}
                  className="w-20 bg-secondary border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
                />
                <select
                  value={singleUnit}
                  onChange={(e) => {
                    const unit = e.target.value;
                    setSingleUnit(unit);
                    onSingleChange(formatCustom(singleAmount, unit));
                  }}
                  className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="m">Minutes</option>
                  <option value="h">Hours</option>
                  <option value="d">Days</option>
                  <option value="w">Weeks</option>
                  <option value="mo">Months</option>
                </select>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Gate Timeframe (Larger)</div>
              <select
                value={gateSelectValue}
                onChange={e => onGateChange(e.target.value === "custom" ? formatCustom(gateAmount, gateUnit) : e.target.value)}
                className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
              >
                {tfWithCustom.map(tf => <option key={tf} value={tf}>{tf === "custom" ? "Custom" : tf}</option>)}
              </select>
              {gateSelectValue === "custom" && (
                <div className="mt-2 flex gap-2">
                  <input
                  type="number"
                  min="1"
                  value={gateAmount}
                  onChange={(e) => {
                      const amount = e.target.value;
                      setGateAmount(amount);
                      if (/^\d+$/.test(amount)) {
                        onGateChange(formatCustom(amount, gateUnit));
                      }
                    }}
                  onBlur={() => commitAmount(gateAmount, gateUnit, setGateAmount, onGateChange)}
                  className="w-20 bg-secondary border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
                />
                <select
                  value={gateUnit}
                  onChange={(e) => {
                    const unit = e.target.value;
                    setGateUnit(unit);
                    onGateChange(formatCustom(gateAmount, unit));
                  }}
                    className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
                  >
                    <option value="m">Minutes</option>
                    <option value="h">Hours</option>
                    <option value="d">Days</option>
                    <option value="w">Weeks</option>
                    <option value="mo">Months</option>
                  </select>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Entry Timeframe (Smaller)</div>
              <select
                value={entrySelectValue}
                onChange={e => onEntryChange(e.target.value === "custom" ? formatCustom(entryAmount, entryUnit) : e.target.value)}
                className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
              >
                {tfWithCustom.map(tf => <option key={tf} value={tf}>{tf === "custom" ? "Custom" : tf}</option>)}
              </select>
              {entrySelectValue === "custom" && (
                <div className="mt-2 flex gap-2">
                  <input
                  type="number"
                  min="1"
                  value={entryAmount}
                  onChange={(e) => {
                      const amount = e.target.value;
                      setEntryAmount(amount);
                      if (/^\d+$/.test(amount)) {
                        onEntryChange(formatCustom(amount, entryUnit));
                      }
                    }}
                  onBlur={() => commitAmount(entryAmount, entryUnit, setEntryAmount, onEntryChange)}
                  className="w-20 bg-secondary border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
                />
                <select
                  value={entryUnit}
                  onChange={(e) => {
                    const unit = e.target.value;
                    setEntryUnit(unit);
                    onEntryChange(formatCustom(entryAmount, unit));
                  }}
                    className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
                  >
                    <option value="m">Minutes</option>
                    <option value="h">Hours</option>
                    <option value="d">Days</option>
                    <option value="w">Weeks</option>
                    <option value="mo">Months</option>
                  </select>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
