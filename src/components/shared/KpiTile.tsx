import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiTileProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Small line under the value (e.g. "of $2.4M planned"). */
  hint?: string;
  /** Accent for signal tiles (always paired with the label text). */
  tone?: "default" | "good" | "warning" | "critical";
}

const TONE_TEXT: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "",
  good: "text-green-700 dark:text-green-400",
  warning: "text-amber-700 dark:text-amber-400",
  critical: "text-red-700 dark:text-red-400",
};

/** Executive stat tile — a headline number with its label. */
export function KpiTile({ label, value, icon: Icon, hint, tone = "default" }: KpiTileProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </div>
      <p className={cn("mt-1.5 text-2xl font-semibold", TONE_TEXT[tone])}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
