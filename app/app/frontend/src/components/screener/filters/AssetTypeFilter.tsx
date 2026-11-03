import type { AssetType } from "@/types/screener";

export function AssetTypeFilter({ value, onChange }: { value: AssetType; onChange: (v: AssetType) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Asset Type</label>
      <div className="flex gap-2">
        {(["stocks", "crypto"] as AssetType[]).map((type) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              value === type
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}
