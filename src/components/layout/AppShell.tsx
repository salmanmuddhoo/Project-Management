import { useState } from "react";
import {
  FileUp,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Menu,
  Search,
  ShieldCheck,
  FileBarChart2,
  X,
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { GlobalSearch } from "@/features/search/GlobalSearch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePortfolioStore } from "@/store/portfolioStore";

import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/kanban", label: "Kanban", icon: ListTodo },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/import", label: "Import", icon: FileUp },
];

export function AppShell() {
  const projectCount = usePortfolioStore((s) => s.projects.length);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setMobileNavOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-card lg:flex">
        <Link to="/" className="flex items-center gap-2 px-5 py-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-bold leading-tight">Portfolio PPM</p>
            <p className="text-[10px] text-muted-foreground">
              Governance &amp; Reporting
            </p>
          </div>
        </Link>
        {nav}
        <div className="mt-auto p-4">
          <p className="rounded-md bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
            All data stays in this browser session. Refreshing or closing the
            tab clears everything.
          </p>
        </div>
      </aside>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r bg-card shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-bold">Portfolio PPM</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            className="h-8 w-full max-w-sm justify-start gap-2 text-xs text-muted-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-3.5 w-3.5" />
            Search portfolio…
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
              Ctrl K
            </kbd>
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="muted" className="hidden sm:inline-flex">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  projectCount > 0 ? "bg-green-600" : "bg-muted-foreground",
                )}
              />
              {projectCount} project{projectCount === 1 ? "" : "s"} in memory
            </Badge>
            <ThemeToggle />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
