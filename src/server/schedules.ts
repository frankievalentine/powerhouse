import { SCHEDULE_LIMITS, type ScheduleInfo } from "../shared";
import { z } from "zod";
import { parseTime } from "./schedule-rules";

const time = z.string().refine((value) => {
  try {
    parseTime(value);
    return true;
  } catch {
    return false;
  }
}, "Use a time like 09:00");

export const scheduleRule = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("daily"), time }),
  z.object({ kind: z.literal("weekdays"), time }),
  z.object({
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Pick at least one day")
      .transform((days) => [...new Set(days)].sort()),
    kind: z.literal("weekly"),
    time,
  }),
  z.object({ every: z.number().int().min(SCHEDULE_LIMITS.minHours).max(SCHEDULE_LIMITS.maxHours), kind: z.literal("hourly") }),
]);

/** Fields a client may send when creating (no id) or editing a schedule. */
export const scheduleInput = z.object({
  enabled: z.boolean().default(true),
  id: z.string().optional(),
  prompt: z.string().trim().min(1, "Describe the job").max(SCHEDULE_LIMITS.prompt),
  roleId: z.string().min(1, "Pick a role"),
  rule: scheduleRule,
  /** The browser's time zone, used only when the org has none yet. */
  timeZone: z.string().optional(),
});

export type ScheduleInput = z.input<typeof scheduleInput>;

export const SCHEDULE_LABELS: Record<string, string> = {
  enabled: "On",
  prompt: "Job",
  roleId: "Role",
  rule: "Repeats",
};

/** A schedule as stored: what clients see, plus the bookkeeping behind its alarm. */
export interface StoredSchedule extends ScheduleInfo {
  /** Hourly rules count their periods from here; reset when the rule changes. */
  anchorAt: number;
  /** The SDK schedule for the next run, if armed. */
  alarmId: string | null;
}

/** A run that fires this late (Org was unavailable) is skipped, not run hours late. */
export const MISSED_RUN_GRACE_MS = 60 * 60_000;
