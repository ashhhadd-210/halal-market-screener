import { useEffect, useMemo, useState } from "react";
import type { PriceRange } from "@/types/screener";

interface Props {
  value: PriceRange | null;
  onChange: (value: PriceRange | null) => void;
}

export function PriceRangeFilter({ value, onChange }: Props) {
  const enabled = value !== null;
  const [minInput, setMinInput] = useState(
    value?.min_price !== undefined && value?.min_price !== null ? String(value.min_price) : "",
  );
  const [maxInput, setMaxInput] = useState(
    value?.max_price !== undefined && value?.max_price !== null ? String(value.max_price) : "",
  );

  useEffect(() => {
    setMinInput(value?.min_price !== undefined && value?.min_price !== null ? String(value.min_price) : "");
    setMaxInput(value?.max_price !== undefined && value?.max_price !== null ? String(value.max_price) : "");
  }, [value?.max_price, value?.min_price]);

  const helper = useMemo(() => {
    if (!enabled) return "Disabled";
    const min = minInput.trim();
    const max = maxInput.trim();
    if (!min && !max) return "Any price";
    if (min && max) return `Range: ${min} - ${max}`;
    if (min) return `Minimum: ${min}`;
    return `Maximum: ${max}`;
  }, [enabled, maxInput, minInput]);

  const apply = (nextMin: string, nextMax: string) => {
    const minPrice = nextMin.trim() === "" ? null : Number(nextMin);
    const maxPrice = nextMax.trim() === "" ? null : Number(nextMax);

    if (!enabled) {
      return;
    }

    onChange({
      min_price: Number.isFinite(minPrice as number) ? (minPrice as number) : null,
      max_price: Number.isFinite(maxPrice as number) ? (maxPrice as number) : null,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (enabled) {
              onChange(null);
              return;
            }
            onChange({ min_price: null, max_price: null });
          }}
          className={`h-4 w-4 rounded border transition-colors ${enabled ? "bg-primary border-primary" : "border-border"}`}
        />
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Average Price Range</label>
      </div>
      <p className="pl-6 text-[10px] text-muted-foreground">{helper}</p>
      {enabled && (
        <div className="grid grid-cols-2 gap-2 pl-6">
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Min</div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={minInput}
              onChange={(e) => {
                const next = e.target.value;
                setMinInput(next);
                apply(next, maxInput);
              }}
              className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Max</div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxInput}
              onChange={(e) => {
                const next = e.target.value;
                setMaxInput(next);
                apply(minInput, next);
              }}
              className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
              placeholder="No cap"
            />
          </div>
        </div>
      )}
    </div>
  );
}
