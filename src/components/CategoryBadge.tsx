import type { Category } from "@/types/expense";
import { CATEGORY_STYLES } from "@/lib/categories";

export function CategoryBadge({ category }: { category: Category }) {
  const s = CATEGORY_STYLES[category];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge}`}>
      <span aria-hidden>{s.icon}</span>
      {category}
    </span>
  );
}
