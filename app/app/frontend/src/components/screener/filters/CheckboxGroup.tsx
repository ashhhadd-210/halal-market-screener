interface Option {
  label: string;
  value: string;
  enabled?: boolean;
}

interface Props {
  options: Option[];
  selected: string[];
  onChange: (v: string[]) => void;
}

export function CheckboxGroup({ options, selected, onChange }: Props) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isEnabled = opt.enabled !== false;
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => isEnabled && toggle(opt.value)}
            disabled={!isEnabled}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
              isSelected
                ? "border-primary bg-primary/10 text-accent-foreground"
                : isEnabled
                ? "border-border bg-secondary/50 text-secondary-foreground hover:border-primary/50"
                : "border-border bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
