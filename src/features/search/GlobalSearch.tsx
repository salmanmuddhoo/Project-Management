/**
 * Global search (Ctrl/Cmd-K) — scans every imported board in memory:
 * projects, tasks, resources and Timorc codes. Results deep-link to the
 * owning project tab.
 */

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { useSnapshots } from "@/store/portfolioStore";

interface SearchHit {
  projectId: string;
  projectName: string;
  kind: string;
  tab: string;
  title: string;
  snippet: string;
}

function collectHits(snapshots: ProjectSnapshot[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  const match = (...fields: Array<string | null | undefined>) => fields.some((f) => f && f.toLowerCase().includes(q));

  for (const s of snapshots) {
    const { project } = s;
    const c = project.charter;
    const base = { projectId: project.id, projectName: c.projectName };
    if (match(c.projectName, c.projectCode, c.manager, c.notes)) {
      hits.push({ ...base, kind: "Project", tab: "overview", title: c.projectName, snippet: `${c.projectCode} · ${c.manager}` });
    }
    for (const code of project.timorcCodes) {
      if (match(code.code)) hits.push({ ...base, kind: "Timorc", tab: "time", title: code.code, snippet: "Timorc code" });
    }
    for (const r of project.resources) {
      if (match(r.name, r.role)) hits.push({ ...base, kind: "Resource", tab: "overview", title: r.name, snippet: r.role });
    }
    for (const t of project.tasks) {
      if (match(t.title, t.assignee, t.notes, t.bucket)) {
        hits.push({ ...base, kind: "Task", tab: "tasks", title: t.title, snippet: `${t.bucket} · ${t.assignee}` });
      }
    }
  }
  return hits.slice(0, 50);
}

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const snapshots = useSnapshots();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpenChange(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const hits = useMemo(() => collectHits(snapshots, query), [snapshots, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 max-w-xl translate-y-0 gap-3 p-4">
        <DialogTitle className="sr-only">Search portfolio</DialogTitle>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input autoFocus placeholder="Search projects, tasks, people, codes…" value={query}
            onChange={(e) => setQuery(e.target.value)} className="border-0 shadow-none focus-visible:ring-0" />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {snapshots.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Import boards first — search runs across everything in memory.</p>}
          {query.trim().length >= 2 && hits.length === 0 && snapshots.length > 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches.</p>
          )}
          <ul className="space-y-0.5">
            {hits.map((hit, i) => (
              <li key={i}>
                <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => { onOpenChange(false); navigate(`/projects/${hit.projectId}?tab=${hit.tab}`); }}>
                  <Badge variant="muted" className="w-20 shrink-0 justify-center">{hit.kind}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{hit.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{hit.projectName} · {hit.snippet}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
