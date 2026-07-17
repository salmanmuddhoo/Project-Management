import * as React from "react";

import { clamp, cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number | null | undefined;
  /** Bar color class; defaults to the primary blue. */
  barClassName?: string;
}

/** Simple determinate progress bar (0–100). */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, barClassName, ...props }, ref) => {
    const pct = clamp(value ?? 0, 0, 100);
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className={cn(
          "h-1.5 w-full overflow-hidden rounded-full bg-muted",
          className,
        )}
        {...props}
      >
        <div
          className={cn("h-full rounded-full bg-primary transition-all", barClassName)}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
