import { Save, FolderOpen, Trash2, Loader2 } from "lucide-react";
import type { FilterPreset } from "@/hooks/useUserSettings";

interface Props {
  presets: FilterPreset[];
  loading: boolean;
  onSave: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PresetBar({ presets, loading, onSave, onLoad, onDelete }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-2 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">Loading presets...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onSave}
        className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[0_10px_30px_hsl(var(--primary)_/_0.3)] transition-transform hover:-translate-y-0.5 hover:bg-primary/90"
      >
        <Save className="h-3.5 w-3.5" />
        Save Preset
      </button>
      {presets.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-1 rounded-full border border-border/80 bg-card/65 pl-1 pr-1.5 shadow-sm backdrop-blur-sm"
        >
          <button
            onClick={() => onLoad(p.id)}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary/50 hover:text-primary"
          >
            <FolderOpen className="h-3 w-3" />
            {p.name}
          </button>
          <button
            onClick={() => onDelete(p.id)}
            className="rounded-full px-2 py-2 text-muted-foreground transition-colors hover:text-destructive"
            aria-label={`Delete preset ${p.name}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      {presets.length === 0 && (
        <span className="rounded-full border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
          No saved presets
        </span>
      )}
    </div>
  );
}
