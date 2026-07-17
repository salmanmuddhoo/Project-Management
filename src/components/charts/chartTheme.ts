/**
 * Chart palette & theme.
 *
 * Values come from the validated reference data-viz palette: eight
 * categorical slots in a fixed, CVD-safe order (never cycled or re-ranked),
 * one sequential blue ramp, and a reserved status palette that is never
 * reused for series. Light and dark are separately validated steps, not an
 * automatic flip.
 */

import { useSyncExternalStore } from "react";

export const CATEGORICAL_LIGHT = [
  "#2a78d6", // blue
  "#008300", // green
  "#e87ba4", // magenta
  "#eda100", // yellow
  "#1baf7a", // aqua
  "#eb6834", // orange
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

export const CATEGORICAL_DARK = [
  "#3987e5",
  "#008300",
  "#d55181",
  "#c98500",
  "#199e70",
  "#d95926",
  "#9085e9",
  "#e66767",
] as const;

/** Sequential blue ramp (light→dark) for magnitude encodings (heat map). */
export const SEQUENTIAL_BLUE = [
  "#cde2fb",
  "#9ec5f4",
  "#6da7ec",
  "#3987e5",
  "#256abf",
  "#184f95",
  "#0d366b",
] as const;

/** Reserved status colors — never used as series colors. */
export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export const RAG_COLORS: Record<"Green" | "Amber" | "Red", string> = {
  Green: STATUS_COLORS.good,
  Amber: STATUS_COLORS.warning,
  Red: STATUS_COLORS.critical,
};

export interface ChartTheme {
  dark: boolean;
  series: readonly string[];
  grid: string;
  axisLine: string;
  tickInk: string;
  surface: string;
  tooltip: {
    backgroundColor: string;
    border: string;
    color: string;
  };
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function isDark() {
  return document.documentElement.classList.contains("dark");
}

/** Reactive chart theme that follows the app's light/dark class. */
export function useChartTheme(): ChartTheme {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  return {
    dark,
    series: dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    grid: dark ? "#2c2c2a" : "#e1e0d9",
    axisLine: dark ? "#383835" : "#c3c2b7",
    tickInk: "#898781",
    surface: dark ? "#1a1a19" : "#fcfcfb",
    tooltip: {
      backgroundColor: dark ? "#262624" : "#ffffff",
      border: dark ? "1px solid #383835" : "1px solid #e1e0d9",
      color: dark ? "#ffffff" : "#0b0b0b",
    },
  };
}

/** Stable color per entity name — color follows the entity, never its rank. */
export function colorForKey(
  key: string,
  keys: string[],
  series: readonly string[],
): string {
  const index = keys.indexOf(key);
  return series[(index >= 0 ? index : 0) % series.length];
}
