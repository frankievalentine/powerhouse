import { createContext, useContext } from "react";
import type { ApprovalRecord } from "../../shared";

/** The open job's agent connection, for tool cards that call job methods (e.g. liveView). */
export interface JobConnection {
  call: <T = unknown>(method: string, args?: unknown[]) => Promise<T>;
}

export const JobConnectionContext = createContext<JobConnection | null>(null);

export function useJobConnection() {
  const connection = useContext(JobConnectionContext);
  if (!connection) {
    throw new Error("useJobConnection must be used inside a LiveSession");
  }
  return connection;
}

/**
 * Whether the viewer may act on the open job (follow up, approve, stop, take
 * over): the person who started it and admins may. Others watch.
 */
export interface JobAccess {
  canAct: boolean;
  /** Who started the job, for "waiting for ..." notes; null for older jobs. */
  owner: string | null;
}

export const JobAccessContext = createContext<JobAccess>({ canAct: true, owner: null });

export function useJobAccess() {
  return useContext(JobAccessContext);
}

/** "alice@example.com or an admin", for notes to people who can only watch. */
export function whoCanAct(owner: string | null) {
  return owner ? `${owner} or an admin` : "an admin";
}

/** Who approved or declined each tool call in the open job, by tool call id. */
export const JobApprovalsContext = createContext<Record<string, ApprovalRecord>>({});

export function useApprovalRecord(toolCallId: string): ApprovalRecord | undefined {
  return useContext(JobApprovalsContext)[toolCallId];
}
