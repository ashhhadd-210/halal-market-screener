import { EXCLUDED_CATEGORIES } from "@/types/screener";
import { CheckboxGroup } from "./CheckboxGroup";

interface Props {
  excluded: string[];
  onChange: (v: string[]) => void;
}

export function EthicalFilter({ excluded, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ethical Filter</label>
      <div className="text-xs text-muted-foreground mb-1">Exclude categories</div>
      <div className="text-xs text-muted-foreground">
        
      </div>
      <CheckboxGroup
        options={EXCLUDED_CATEGORIES}
        selected={excluded}
        onChange={onChange}
      />
    </div>
  );
}
