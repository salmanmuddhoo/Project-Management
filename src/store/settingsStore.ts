/**
 * User settings (Zustand, persisted to localStorage).
 *
 * Unlike project data — which is deliberately never stored — settings are
 * preferences: they hold no project content and are kept across sessions so a
 * team's thresholds don't have to be re-entered after every refresh.
 *
 * Anything read back (from storage or an imported JSON file) is sanitised
 * against `DEFAULT_SETTINGS`: unknown keys are dropped and wrongly-typed values
 * fall back to their default, so a stale or hand-edited file can't break the
 * calculations.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/config";

export const SETTINGS_STORAGE_KEY = "ppm-settings";

/** Merge any partial/untrusted object onto the defaults, keeping only valid values. */
export function sanitizeSettings(input: unknown): AppSettings {
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  if (input == null || typeof input !== "object") return out;
  const src = input as Record<string, unknown>;
  const target = out as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>) {
    const def = DEFAULT_SETTINGS[key];
    const val = src[key];
    if (typeof def === "number") {
      if (typeof val === "number" && Number.isFinite(val)) target[key] = val;
    } else if (typeof def === "string") {
      if (typeof val === "string" && val.trim()) target[key] = val.trim();
    } else if (Array.isArray(def)) {
      if (Array.isArray(val)) {
        const list = val.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
        target[key] = list;
      }
    }
  }
  return out;
}

interface SettingsState {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: (key?: keyof AppSettings) => void;
  replace: (next: unknown) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      update: (patch) => set((s) => ({ settings: sanitizeSettings({ ...s.settings, ...patch }) })),
      reset: (key) =>
        set((s) =>
          key == null
            ? { settings: DEFAULT_SETTINGS }
            : { settings: { ...s.settings, [key]: DEFAULT_SETTINGS[key] } },
        ),
      replace: (next) => set({ settings: sanitizeSettings(next) }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings }),
      merge: (persisted, current) => ({
        ...current,
        settings: sanitizeSettings((persisted as { settings?: unknown } | undefined)?.settings),
      }),
    },
  ),
);

/** Current settings, for non-React code (parsers, exporters, metric defaults). */
export function getSettings(): AppSettings {
  return useSettingsStore.getState().settings;
}

/** Current settings as a React hook (re-renders on change). */
export function useSettings(): AppSettings {
  return useSettingsStore((s) => s.settings);
}
