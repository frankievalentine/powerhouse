import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { useAgentChat } from "@cloudflare/think/react";
import { useAgent } from "agents/react";
import { ArrowUp, Square } from "lucide-react";
import { useOrg } from "../org/org-context";
import { useEffect, useState } from "react";
import type { ApprovalRecord } from "../../shared";
import { type JobAccess, JobAccessContext, JobApprovalsContext, JobConnectionContext, whoCanAct } from "./job-connection";
import styles from "./live-session.module.css";
import { sessionComponents } from "./tool-uis";

function UserMessage() {
  return (
    <MessagePrimitive.Root className={styles.user}>
      <MessagePrimitive.Parts />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className={styles.assistant}>
      <MessagePrimitive.Parts components={sessionComponents} />
    </MessagePrimitive.Root>
  );
}

/**
 * assistant-ui thread bound to one job's agent, reached through the Org's
 * sub-agent route. The composer sends follow-ups into the same job, and
 * approvals answered here resume it.
 */
export function LiveSession({ runId, live, access }: { runId: string; live: boolean; access: JobAccess }) {
  const { orgId, cancel } = useOrg();
  const agent = useAgent({
    agent: "org",
    name: orgId,
    sub: [{ agent: "job-agent", name: runId }],
  });
  const chat = useAgentChat({ agent });
  // useAgentChat replaces useChat's addToolOutput with its own signature; jobs
  // have no client-side tools, so the runtime never calls it.
  const runtime = useAISDKRuntime(chat as unknown as Parameters<typeof useAISDKRuntime>[0]);

  // Who approved what; reloaded whenever the transcript changes, which is
  // when an approval can have been given.
  const [approvals, setApprovals] = useState<Record<string, ApprovalRecord>>({});
  const transcriptKey = chat.messages.map((m) => `${m.id}:${m.parts.length}`).join();
  useEffect(() => {
    if (!transcriptKey.includes(":")) {
      return;
    }
    agent.call<Record<string, ApprovalRecord>>("approvals", []).then(setApprovals, () => {});
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
      </JobApprovalsContext.Provider>
      </JobAccessContext.Provider>
    </JobConnectionContext.Provider>
  );
}
