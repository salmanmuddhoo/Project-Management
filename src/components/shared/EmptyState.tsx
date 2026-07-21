import { FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

/** Shown by every page when no workbooks have been imported this session. */
export function EmptyState({
  title = "No projects in this session",
  description = "Import your Microsoft Planner board export(s) and Timorc time file to build the portfolio. Everything is processed in your browser — nothing is uploaded or stored.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-20 text-center">
      <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      <Button asChild className="mt-6">
        <Link to="/import">Import workbooks</Link>
      </Button>
    </div>
  );
}
