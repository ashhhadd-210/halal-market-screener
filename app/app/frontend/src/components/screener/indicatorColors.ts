import { INDICATOR_CATEGORY_COLORS, INDICATOR_CATEGORY_MAP } from "@/types/screener";

export function getIndicatorColor(badge: string) {
  const lowered = badge.toLowerCase();

  for (const [name, category] of Object.entries(INDICATOR_CATEGORY_MAP)) {
    if (lowered.startsWith(name.toLowerCase())) {
      return INDICATOR_CATEGORY_COLORS[category];
    }
  }

  if (lowered.includes("confluence")) {
    return INDICATOR_CATEGORY_COLORS.confluence;
  }

  if (lowered.includes("channel") || lowered.includes("respect")) {
    return INDICATOR_CATEGORY_COLORS.channel;
  }

  return {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  };
}
