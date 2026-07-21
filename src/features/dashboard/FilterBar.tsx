/** Portfolio filter bar — project, manager, health (RAG) and date range. */

import { useMemo } from "react";
import { ChevronDown, FilterX } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePortfolioStore, useSnapshots } from "@/store/portfolioStore";
import type { PortfolioFilters } from "@/types/filters";

type ListKey = "projects" | "managers" | "health";

function DimensionFilter({
  label,
  filterKey,
  options,
}: {
  label: string;
  filterKey: ListKey;
  options: Array<{ value: string; label: string }>;
}) {
  const selected = usePortfolioStore((s) => s.filters[filterKey]);
  const setFilters = usePortfolioStore((s) => s.setFilters);
  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    setFilters({ [filterKey]: next } as Partial<PortfolioFilters>);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 gap-1 text-xs", selected.length > 0 && "border-primary text-primary")}>
          {label}{selected.length > 0 && ` (${selected.length})`}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No values</p>}
        {options.map((o) => (
          <DropdownMenuCheckboxItem key={o.value} checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)}>
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FilterBar() {
  const snapshots = useSnapshots();
  const filters = usePortfolioStore((s) => s.filters);
  const setFilters = usePortfolioStore((s) => s.setFilters);
  const resetFilters = usePortfolioStore((s) => s.resetFilters);

  const options = useMemo(() => {
    const distinct = (values: string[]) => [...new Set(values.filter(Boolean))].sort().map((v) => ({ value: v, label: v }));
    return {
      projects: snapshots.map((s) => ({ value: s.project.id, label: s.project.charter.projectName })),
      managers: distinct(snapshots.map((s) => s.project.charter.manager)),
      health: ["Green", "Amber", "Red"].map((v) => ({ value: v, label: v })),
    };
  }, [snapshots]);

  const hasActive =
    filters.projects.length > 0 || filters.managers.length > 0 || filters.health.length > 0 ||
    filters.dateFrom != null || filters.dateTo != null;
  const toInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DimensionFilter label="Project" filterKey="projects" options={options.projects} />
      <DimensionFilter label="Manager" filterKey="managers" options={options.managers} />
      <DimensionFilter label="Health" filterKey="health" options={options.health} />
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Input type="date" aria-label="From date" className="h-8 w-36 text-xs" value={toInput(filters.dateFrom)}
          onChange={(e) => setFilters({ dateFrom: e.target.value ? new Date(e.target.value) : null })} />
        <span>–</span>
        <Input type="date" aria-label="To date" className="h-8 w-36 text-xs" value={toInput(filters.dateTo)}
          onChange={(e) => setFilters({ dateTo: e.target.value ? new Date(e.target.value) : null })} />
      </div>
      {hasActive && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
          <FilterX className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
