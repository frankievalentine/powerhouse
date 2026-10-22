import { AUTO_MODEL, DEFAULT_MODEL, modelInfo, type OrgSettings, SETTINGS_LIMITS } from "../shared";
import { z } from "zod";
import { DEFAULT_ROLE_ID, hostList, modelId } from "./roles";
import { isTimeZone } from "./schedule-rules";

export function defaultSettings(orgId: string): OrgSettings {
  return {
    approveBrowserActions: false,
    autoRoute: true,
    blockedHosts: [],
    companyProfile: "",
    dailyBudgetUsd: 0,
    fallbackRoleId: DEFAULT_ROLE_ID,
    historyLimit: 50,
    jobModel: AUTO_MODEL,
    maxConcurrentJobs: 10,
    maxSteps: 8,
    orgName: orgId,
    routerModel: DEFAULT_MODEL,
    timeZone: "",
  };
}

const { historyLimit, maxConcurrentJobs, maxSteps } = SETTINGS_LIMITS;

/** Every field is optional so the client can save one section at a time. */
export const settingsInput = z
  .object({
    approveBrowserActions: z.boolean(),
    autoRoute: z.boolean(),
    blockedHosts: hostList(SETTINGS_LIMITS.blockedHosts),
    companyProfile: z.string().trim().max(SETTINGS_LIMITS.companyProfile),
    dailyBudgetUsd: z.number().min(SETTINGS_LIMITS.dailyBudgetUsd.min).max(SETTINGS_LIMITS.dailyBudgetUsd.max),
    fallbackRoleId: z.string().min(1),
    historyLimit: z.number().int().min(historyLimit.min).max(historyLimit.max),
    jobModel: z.union([modelId, z.literal(AUTO_MODEL)]),
    maxConcurrentJobs: z.number().int().min(maxConcurrentJobs.min).max(maxConcurrentJobs.max),
    maxSteps: z.number().int().min(maxSteps.min).max(maxSteps.max),
    orgName: z.string().trim().min(1).max(SETTINGS_LIMITS.orgName),
    // The backup router calls Workers AI directly, without the gateway.
    routerModel: modelId.refine((id) => modelInfo(id)?.provider === "workers-ai", "Pick a Workers AI model"),
    timeZone: z.string().refine((value) => value === "" || isTimeZone(value), "Not a known time zone"),
  })
  .partial();

export type SettingsInput = z.input<typeof settingsInput>;

/** Settings labels as the Settings sheet shows them, for validation messages. */
export const SETTINGS_LABELS: Record<string, string> = {
  approveBrowserActions: "Ask before browser actions",
  autoRoute: "Automatic routing",
  blockedHosts: "Blocked sites",
  companyProfile: "Company profile",
  dailyBudgetUsd: "Daily budget",
  fallbackRoleId: "Fallback role",
  historyLimit: "History size",
  jobModel: "Job model",
  maxConcurrentJobs: "Concurrent jobs",
  maxSteps: "Steps per turn",
  orgName: "Organization name",
  routerModel: "Backup router model",
  timeZone: "Time zone",
};
