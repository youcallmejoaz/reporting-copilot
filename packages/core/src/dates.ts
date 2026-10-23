import type { DateRange } from "./types.js";

const DAY = 86_400_000;

export function parseDate(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  return fmtDate(new Date(parseDate(d).getTime() + n * DAY));
}

export function daysBetween(start: string, end: string): number {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / DAY) + 1;
}

export function daysInMonth(d: string): number {
  const dt = parseDate(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
}

export function monthStart(d: string): string {
  return `${d.slice(0, 7)}-01`;
}

export function prettyRange(r: { start: string; end: string }): string {
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const s = parseDate(r.start).toLocaleDateString("en-US", o);
  const e = parseDate(r.end).toLocaleDateString("en-US", { ...o, year: "numeric" });
  return `${s} – ${e}`;
}

export const PRESETS = ["last_7d", "prev_7d", "last_14d", "last_30d", "mtd", "last_month", "all"] as const;
export type Preset = (typeof PRESETS)[number];

/**
 * Resolve a preset ("last_7d", "mtd", ...) or an explicit "YYYY-MM-DD..YYYY-MM-DD" range relative to asOf.
 */
export function resolveRange(input: string, asOf: string): DateRange {
  const explicit = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(input.trim());
  if (explicit) {
    const [, start, end] = explicit;
    if (start > end) throw new Error(`Invalid date range ${input}: start is after end`);
    return { start, end, label: prettyRange({ start, end }) };
  }
  switch (input as Preset) {
    case "last_7d":
      return { start: addDays(asOf, -6), end: asOf, label: "Last 7 days" };
    case "prev_7d":
      return { start: addDays(asOf, -13), end: addDays(asOf, -7), label: "Previous 7 days" };
    case "last_14d":
      return { start: addDays(asOf, -13), end: asOf, label: "Last 14 days" };
    case "last_30d":
      return { start: addDays(asOf, -29), end: asOf, label: "Last 30 days" };
    case "mtd":
      return { start: monthStart(asOf), end: asOf, label: "Month to date" };
    case "last_month": {
      const end = addDays(monthStart(asOf), -1);
      return { start: monthStart(end), end, label: "Last month" };
    }
    case "all":
      return { start: "2000-01-01", end: asOf, label: "All available data" };
    default:
      throw new Error(`Unknown date range "${input}". Use one of ${PRESETS.join(", ")} or YYYY-MM-DD..YYYY-MM-DD.`);
  }
}
