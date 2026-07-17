/**
 * Semantic badges. Status/RAG colors are reserved signal colors and always
 * ship with a text label (never color alone).
 */

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  MinusCircle,
  PauseCircle,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RagStatus } from "@/types/project";

export function RagBadge({ rag, score }: { rag: RagStatus; score?: number }) {
  const styles: Record<RagStatus, string> = {
    Green:
      "bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/30",
    Amber:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    Red: "bg-red-600/10 text-red-700 dark:text-red-400 border-red-600/30",
  };
  const Icon =
    rag === "Green" ? CheckCircle2 : rag === "Amber" ? AlertTriangle : XCircle;
  return (
    <Badge variant="outline" className={cn("gap-1", styles[rag])}>
      <Icon className="h-3 w-3" />
      {rag}
      {score != null && <span className="tnum">{score}</span>}
    </Badge>
  );
}

const STATUS_META: Record<
  string,
  { icon: typeof CircleDot; className: string }
> = {
  "on track": {
    icon: CircleDot,
    className:
      "bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/30",
  },
  completed: {
    icon: CheckCircle2,
    className:
      "bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-600/30",
  },
  "at risk": {
    icon: AlertTriangle,
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  delayed: {
    icon: AlertTriangle,
    className: "bg-red-600/10 text-red-700 dark:text-red-400 border-red-600/30",
  },
  "on hold": {
    icon: PauseCircle,
    className: "bg-muted text-muted-foreground border-border",
  },
  cancelled: {
    icon: MinusCircle,
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status.trim().toLowerCase()] ?? {
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground border-border",
  };
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1", meta.className)}>
      <Icon className="h-3 w-3" />
      {status || "Not set"}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-600/10 text-red-700 dark:text-red-400 border-red-600/30",
    high: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
    medium:
      "bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-600/30",
    low: "bg-muted text-muted-foreground border-border",
  };
  const key = priority.trim().toLowerCase();
  if (!key) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={styles[key] ?? styles.low}>
      {priority}
    </Badge>
  );
}
