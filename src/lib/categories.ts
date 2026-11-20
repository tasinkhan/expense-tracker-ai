import type { Category } from "@/types/expense";

/**
 * Chart colors follow the category (never its rank), in a fixed order validated
 * for color-vision deficiency. Every chart also labels categories in text.
 */
export const CATEGORY_STYLES: Record<Category, { color: string; badge: string; icon: string }> = {
  Food: { color: "#eb6834", badge: "bg-orange-50 text-orange-700 ring-orange-600/20", icon: "🍔" },
  Transportation: { color: "#2a78d6", badge: "bg-blue-50 text-blue-700 ring-blue-600/20", icon: "🚗" },
  Entertainment: { color: "#eda100", badge: "bg-amber-50 text-amber-800 ring-amber-600/20", icon: "🎬" },
  Shopping: { color: "#6250d6", badge: "bg-violet-50 text-violet-700 ring-violet-600/20", icon: "🛍️" },
  Bills: { color: "#1baf7a", badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", icon: "🧾" },
  Other: { color: "#e87ba4", badge: "bg-pink-50 text-pink-700 ring-pink-600/20", icon: "📦" },
};
