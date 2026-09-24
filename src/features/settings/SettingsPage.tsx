/**
 * Settings — every threshold, weight and name the calculations use, editable
 * in the browser. Defaults are the values the app ships with
 * (`DEFAULT_SETTINGS` in `src/lib/config.ts`); changes apply immediately to
 * every page and report and are remembered in this browser.
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Download, RotateCcw, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_SETTINGS,
  SETTING_GROUPS,
  settingsWarnings,
  type AppSettings,
  type SettingField,
  type SettingGroup,
} from "@/lib/config";
import { healthWeights } from "@/lib/metrics/healthScore";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isModified = (s: AppSettings, key: keyof AppSettings) => !sameValue(s[key], DEFAULT_SETTINGS[key]);

function displayDefault(field: SettingField): string {
  const def = DEFAULT_SETTINGS[field.key];
  if (Array.isArray(def)) return def.join(", ");
  return field.kind === "number" && field.unit ? `${def} ${field.unit}` : String(def);
}

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const reset = useSettingsStore((s) => s.reset);
  const replace = useSettingsStore((s) => s.replace);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const modifiedCount = (Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>).filter((k) =>
    isModified(settings, k),
  ).length;
  const warnings = settingsWarnings(settings);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: "ppm-portfolio", version: 1, settings }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ppm-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const body =
        parsed && typeof parsed === "object" && "settings" in parsed
          ? (parsed as { settings: unknown }).settings
          : parsed;
      if (!body || typeof body !== "object") throw new Error("not an object");
      replace(body);
      setMessage({ tone: "ok", text: `Imported settings from ${file.name}. Missing or invalid values use their defaults.` });
    } catch {
      setMessage({ tone: "error", text: `${file.name} is not a valid settings file.` });
    }
  };

  const resetAll = () => {
    if (window.confirm("Reset every setting to its default value?")) {
      reset();
      setMessage({ tone: "ok", text: "All settings reset to their defaults." });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Thresholds, weights and names used by the calculations. Changes apply immediately to every
            page and report, and are remembered in this browser. No project data is saved.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {modifiedCount > 0 && <Badge variant="secondary">{modifiedCount} changed from default</Badge>}
          <Button variant="outline" size="sm" onClick={exportJson}>
            <Download /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload /> Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={resetAll} disabled={modifiedCount === 0}>
            <RotateCcw /> Reset all
          </Button>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            message.tone === "ok"
              ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
              : "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400",
          )}
        >
          {message.text}
        </p>
      )}

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" /> Check these settings
          </p>
          <ul className="mt-1 list-disc pl-6 text-amber-800 dark:text-amber-300">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {SETTING_GROUPS.map((group) => (
        <SettingsGroupCard key={group.id} group={group} settings={settings} />
      ))}
    </div>
  );
}

function SettingsGroupCard({ group, settings }: { group: SettingGroup; settings: AppSettings }) {
  const reset = useSettingsStore((s) => s.reset);
  const [open, setOpen] = useState(!group.advanced);
  const changed = group.fields.filter((f) => isModified(settings, f.key));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <button
          type="button"
          className="flex flex-1 items-start gap-2 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 transition-transform", !open && "-rotate-90")} />
          <div className="space-y-1">
            <CardTitle>{group.title}</CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </div>
        </button>
        {changed.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => changed.forEach((f) => reset(f.key))}
            title="Reset this section to its defaults"
          >
            <RotateCcw /> Reset section
          </Button>
        )}
      </CardHeader>
      {open && (
        <CardContent>
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {group.fields.map((field) => (
              <FieldRow key={field.key} field={field} settings={settings} />
            ))}
          </div>
          {group.id === "health" && <EffectiveWeights settings={settings} />}
        </CardContent>
      )}
    </Card>
  );
}

function EffectiveWeights({ settings }: { settings: AppSettings }) {
  const w = healthWeights(settings);
  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
  return (
    <p className="mt-4 text-xs text-muted-foreground">
      Effective weights: Schedule {pct(w.schedule)} · Budget {pct(w.budget)} · Delivery {pct(w.delivery)}
    </p>
  );
}

/** Text shown in the input for the current stored value. */
function toDraft(field: SettingField, value: AppSettings[keyof AppSettings]): string {
  if (field.kind === "list") return (value as string[]).join("\n");
  return String(value);
}

const parseList = (text: string) => text.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);

/** The value a draft stands for (undefined when it isn't a valid value yet). */
function fromDraft(field: SettingField, text: string): unknown {
  if (field.kind === "list") return parseList(text);
  if (field.kind === "text") return text.trim() || undefined;
  const n = Number(text.replace(",", "."));
  return text.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

function FieldRow({ field, settings }: { field: SettingField; settings: AppSettings }) {
  const update = useSettingsStore((s) => s.update);
  const reset = useSettingsStore((s) => s.reset);
  const value = settings[field.key];
  const modified = isModified(settings, field.key);

  // Local draft so partially typed values ("0.", "") don't fight the store.
  const [draft, setDraft] = useState(() => toDraft(field, value));
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef(draft);
  // Resync only when the store changed underneath us (reset, import) — not
  // when it merely echoes what is being typed.
  useEffect(() => {
    if (!sameValue(fromDraft(field, draftRef.current), value)) {
      const next = toDraft(field, value);
      draftRef.current = next;
      setDraft(next);
      setError(null);
    }
  }, [field, value]);

  const commit = (text: string) => {
    draftRef.current = text;
    setDraft(text);
    if (field.kind === "number") {
      const n = Number(text.replace(",", "."));
      if (text.trim() === "" || !Number.isFinite(n)) return setError("Enter a number.");
      if (n < field.min) return setError(`Must be at least ${field.min}.`);
      if (field.max != null && n > field.max) return setError(`Must be at most ${field.max}.`);
      if (field.integer && !Number.isInteger(n)) return setError("Must be a whole number.");
      setError(null);
      if (n !== value) update({ [field.key]: n } as Partial<AppSettings>);
    } else if (field.kind === "text") {
      if (!text.trim()) return setError("Cannot be empty.");
      setError(null);
      if (text.trim() !== value) update({ [field.key]: text.trim() } as Partial<AppSettings>);
    } else {
      const list = parseList(text);
      setError(null);
      if (!sameValue(list, value)) update({ [field.key]: list } as Partial<AppSettings>);
    }
  };

  const id = `setting-${field.key}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {field.label}
          {modified && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" title="Changed from default" />}
        </label>
        {modified && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => reset(field.key)}
          >
            <RotateCcw className="h-3 w-3" /> Default
          </button>
        )}
      </div>

      {field.kind === "list" ? (
        <Textarea
          id={id}
          value={draft}
          rows={Math.max(4, draft.split("\n").length)}
          className="min-h-0 font-mono text-xs"
          onChange={(e) => commit(e.target.value)}
        />
      ) : (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type={field.kind === "number" ? "number" : "text"}
            inputMode={field.kind === "number" ? "decimal" : undefined}
            min={field.kind === "number" ? field.min : undefined}
            max={field.kind === "number" ? field.max : undefined}
            step={field.kind === "number" ? (field.step ?? "any") : undefined}
            value={draft}
            aria-invalid={error != null}
            className={cn(field.kind === "number" && "max-w-[10rem] tnum", error && "border-red-600 focus-visible:ring-red-600")}
            onChange={(e) => commit(e.target.value)}
            onBlur={() => {
              if (error) {
                const next = toDraft(field, value);
                draftRef.current = next;
                setDraft(next);
                setError(null);
              }
            }}
          />
          {field.kind === "number" && field.unit && (
            <span className="text-xs text-muted-foreground">{field.unit}</span>
          )}
        </div>
      )}

      {error ? (
        <p className="text-[11px] text-red-600">{error}</p>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {field.help} <span className="whitespace-nowrap">Default: {displayDefault(field)}.</span>
        </p>
      )}
    </div>
  );
}
