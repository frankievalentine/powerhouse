import type { ScheduleRule } from "../shared";

/**
 * The SDK's cron schedules run in UTC, so "9:00 every Monday" would drift an
 * hour at every daylight-saving change. Schedules instead keep a rule and a
 * time zone, and Org sets a one-shot alarm for the next run computed here.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Far enough to find the next match of any rule: weekly rules repeat within 7 days. */
const SEARCH_DAYS = 8;

/**
 * The first run strictly after `afterMs`. Hourly rules count from `anchorMs`
 * (when the schedule was created or last changed), so they keep their rhythm
 * across restarts. A time that does not exist locally (the hour skipped when
 * clocks go forward) runs an hour later; a repeated hour runs once.
 */
export function nextRunAt(rule: ScheduleRule, timeZone: string, afterMs: number, anchorMs: number): number {
  if (rule.kind === "hourly") {
    const period = rule.every * HOUR_MS;
    const elapsed = Math.max(0, afterMs - anchorMs);
    return anchorMs + (Math.floor(elapsed / period) + 1) * period;
  }
  const [hour, minute] = parseTime(rule.time);
  const days = rule.kind === "daily" ? null : rule.kind === "weekdays" ? [1, 2, 3, 4, 5] : rule.days;
  const today = localDate(afterMs, timeZone);
  for (let offset = 0; offset < SEARCH_DAYS; offset++) {
    // Calendar arithmetic on a UTC date, which has no daylight saving.
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day) + offset * DAY_MS);
    if (days && !days.includes(date.getUTCDay())) {
      continue;
    }
    const at = zonedToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute, timeZone);
    if (at > afterMs) {
      return at;
    }
  }
  throw new Error(`No upcoming run for ${JSON.stringify(rule)}`);
}

/** True for an IANA zone name this runtime knows, like "Europe/Berlin". */
export function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function parseTime(time: string): [number, number] {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    throw new Error(`Invalid time "${time}"; use HH:MM, 24-hour.`);
  }
  return [Number(match[1]), Number(match[2])];
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(ms: number, timeZone: string) {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      hour: "numeric",
      hourCycle: "h23",
      minute: "numeric",
      month: "numeric",
      second: "numeric",
      timeZone,
      year: "numeric",
    });
    formatters.set(timeZone, format);
  }
  const parts = Object.fromEntries(format.formatToParts(ms).map((p) => [p.type, Number(p.value)]));
  return {
    day: parts.day as number,
    hour: parts.hour as number,
    minute: parts.minute as number,
    month: parts.month as number,
    second: parts.second as number,
    year: parts.year as number,
  };
}

function localDate(ms: number, timeZone: string) {
  const { day, month, year } = wallClock(ms, timeZone);
  return { day, month, year };
}

/** How far the zone's wall clock is ahead of UTC at an instant, in milliseconds. */
function offsetAt(ms: number, timeZone: string) {
  const c = wallClock(ms, timeZone);
  return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second) - Math.floor(ms / 1000) * 1000;
}

/** The instant a local wall-clock time happens in a zone. */
function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const first = asUtc - offsetAt(asUtc, timeZone);
  const second = asUtc - offsetAt(first, timeZone);
  // Inside a skipped hour neither guess reads back as the asked-for time;
  // the later one is the time after the skip.
  return Math.max(first, second);
}
