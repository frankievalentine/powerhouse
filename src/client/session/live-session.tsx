import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { useAgentChat } from "@cloudflare/think/react";
import { useAgent } from "agents/react";
import { ArrowUp, Square } from "lucide-react";
import { useOrg } from "../org/org-context";
import { useContext, useEffect, useState } from "react";
import { type ApprovalRecord, JOB_HARNESSES, type JobHarness } from "../../shared";
import {
  type JobAccess,
  JobAccessContext,
  JobApprovalsContext,
  JobCompactionsContext,
  JobConnectionContext,
  whoCanAct,
} from "./job-connection";
import styles from "./live-session.module.css";
import { sessionComponents } from "./tool-uis";

/**
 * After the last message a summary covers: the model now sees the steps
 * above as a summary, though the transcript keeps them all.
 */
function CompactionNote() {
  const id = useAuiState((s) => s.message.id);
  return useContext(JobCompactionsContext).has(id) ? (
    <p className={styles.compacted}>Steps above were summarized to fit the model's context.</p>
  ) : null;
}

function UserMessage() {
  return (
    <>
      <MessagePrimitive.Root className={styles.user}>
        <MessagePrimitive.Parts />
      </MessagePrimitive.Root>
      <CompactionNote />
    </>
  );
}

function AssistantMessage() {
  return (
    <>
      <MessagePrimitive.Root className={styles.assistant}>
        <MessagePrimitive.Parts components={sessionComponents} />
      </MessagePrimitive.Root>
      <CompactionNote />
    </>
  );
}

/**
 * assistant-ui thread bound to one job's agent, reached through the Org's
 * sub-agent route. The composer sends follow-ups into the same job, and
 * approvals answered here resume it.
 */
export function LiveSession({
  runId,
  harness,
  live,
  access,
}: {
  runId: string;
  harness: JobHarness | undefined;
  live: boolean;
  access: JobAccess;
}) {
  const { orgId, cancel } = useOrg();
  const agent = useAgent({
    agent: "org",
    name: orgId,
    sub: [{ agent: JOB_HARNESSES[harness ?? "think"], name: runId }],
  });
  const chat = useAgentChat({ agent });
  // useAgentChat replaces useChat's addToolOutput with its own signature; jobs
  // have no client-side tools, so the runtime never calls it.
  const runtime = useAISDKRuntime(chat as unknown as Parameters<typeof useAISDKRuntime>[0]);

  // Who approved what, and where the history was summarized; reloaded
  // whenever the transcript changes, which is when either can have changed.
  const [approvals, setApprovals] = useState<Record<string, ApprovalRecord>>({});
  const [compactions, setCompactions] = useState<ReadonlySet<string>>(new Set());
  const transcriptKey = chat.messages.map((m) => `${m.id}:${m.parts.length}`).join();
  useEffect(() => {
    if (!transcriptKey.includes(":")) {
      return;
    }
    agent.call<Record<string, ApprovalRecord>>("approvals", []).then(setApprovals, () => {});
    // A failed read shows no notes; the transcript is the same either way.
    agent.call<string[]>("compactions", []).then((ids) => setCompactions(new Set(ids)), () => {});
  }, [agent, transcriptKey]);

  // A headless first turn belongs to the Org's run registry, so cancelling
  // there stops it; a turn this socket is streaming stops through chat.stop().
  const stop = () => {
    chat.stop();
    void cancel(runId);
  };

  return (
    <JobConnectionContext.Provider value={agent}>
      <JobAccessContext.Provider value={access}>
      <JobApprovalsContext.Provider value={approvals}>
      <JobCompactionsContext.Provider value={compactions}>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className={styles.root}>
          <ThreadPrimitive.Viewport className={styles.viewport}>
            <ThreadPrimitive.Messages components={{ AssistantMessage, UserMessage }} />
          </ThreadPrimitive.Viewport>
          {access.canAct ? (
            <ComposerPrimitive.Root className={styles.composer}>
              <ComposerPrimitive.Input
                className={styles.input}
                placeholder={live ? "Steer this job..." : "Follow up on this job..."}
                rows={1}
              />
              {live && (
                <button aria-label="Stop job" className={styles.stop} onClick={stop} type="button">
                  <Square aria-hidden="true" size={11} />
                </button>
              )}
              <ComposerPrimitive.Send aria-label="Send" className={styles.send}>
                <ArrowUp aria-hidden="true" size={14} />
              </ComposerPrimitive.Send>
            </ComposerPrimitive.Root>
          ) : (
            <p className={styles.watchOnly}>Only {whoCanAct(access.owner)} can follow up on this job.</p>
          )}
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
      </JobCompactionsContext.Provider>
      </JobApprovalsContext.Provider>
      </JobAccessContext.Provider>
    </JobConnectionContext.Provider>
  );
}
