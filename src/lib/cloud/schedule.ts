export type Frequency = "daily" | "weekly" | "monthly";

export interface ScheduleTiming {
  frequency: Frequency;
  /** 0 = Sunday … 6 = Saturday (weekly only). */
  weekday: number;
  /** 1–28 (monthly only; capped at 28 so every month has it). */
  monthDay: number;
  /** "HH:MM", local time. */
  time: string;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function describeSchedule(t: ScheduleTiming): string {
  const at = formatTime(t.time);
  if (t.frequency === "daily") return `Every day at ${at}`;
  if (t.frequency === "weekly") return `Every ${WEEKDAYS[t.weekday]} at ${at}`;
  return `Monthly on the ${ordinal(t.monthDay)} at ${at}`;
}

/** The first run strictly after `after`. */
export function nextRun(t: ScheduleTiming, after: Date): Date {
  const [h, m] = t.time.split(":").map(Number);
  const c = new Date(after.getFullYear(), after.getMonth(), after.getDate(), h, m, 0, 0);
  if (t.frequency === "daily") {
    if (c <= after) c.setDate(c.getDate() + 1);
    return c;
  }
  if (t.frequency === "weekly") {
    c.setDate(c.getDate() + ((t.weekday - c.getDay() + 7) % 7));
    if (c <= after) c.setDate(c.getDate() + 7);
    return c;
  }
  c.setDate(t.monthDay);
  if (c <= after) c.setMonth(c.getMonth() + 1, t.monthDay);
  return c;
}

/** Whether a run became due between `since` (last run or creation) and `now`. */
export const isDue = (t: ScheduleTiming, since: Date, now: Date) => nextRun(t, since) <= now;

export function formatRelative(iso: string | Date, now = new Date()): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 45_000) return diff < 0 ? "just now" : "in a moment";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
