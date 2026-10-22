import type {
  MessagePrimitive,
  ReasoningMessagePartComponent,
  TextMessagePartComponent,
  ToolCallMessagePartComponent,
  ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import clsx from "clsx";
import { ChevronRight, ExternalLink, Globe, Hand, Mail, MonitorPlay, ShieldQuestion, Sparkles } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";
import { AgentGlyph } from "../components/agent-state";
import { useApprovalRecord, useJobAccess, useJobConnection, whoCanAct } from "./job-connection";
import styles from "./live-session.module.css";

/**
 * Images in model output render as links, never load: a reply can repeat
 * text injected by a fetched page or a connection, and an image URL that
 * loads on its own would send data out with no click (the CSP blocks it
 * too).
 */
const MarkdownImage = ({ src, alt }: { src?: string | Blob; alt?: string }) =>
  typeof src === "string" && /^https?:/i.test(src) ? (
    <a href={src} rel="noopener noreferrer" target="_blank">
      {alt ? `Image: ${alt}` : "Image link"}
    </a>
  ) : (
    <span>{alt ? `[Image: ${alt}]` : "[Image]"}</span>
  );

/** Model output is markdown; MarkdownTextPrimitive reads the part from context and smooths streaming. */
const Text: TextMessagePartComponent = () => (
  <MarkdownTextPrimitive className={styles.text} components={{ img: MarkdownImage }} />
);

/**
 * Collapsed by default: the transcript leads with what the job did and said,
 * and the model's thinking stays one click away for working out why.
 */
const Reasoning: ReasoningMessagePartComponent = ({ text, status }) => {
  const running = status.type === "running";
  return (
    <details className={styles.reasoning}>
      <summary>
        {running ? (
          <span className={styles.shimmer}>Thinking...</span>
        ) : (
          <>
            Thought
            <ChevronRight aria-hidden="true" className={styles.reasoningChevron} size={12} />
          </>
        )}
      </summary>
      <p>{text}</p>
    </details>
  );
};

function ToolFrame({
  icon,
  title,
  running,
  error,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  running: boolean;
  error?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={clsx(styles.tool, error && styles.toolError)}>
      <div className={styles.toolHead}>
        <span className={styles.toolIcon}>{icon}</span>
        <span className={styles.toolTitle}>{title}</span>
        <AgentGlyph state={running ? "running" : error ? "error" : "completed"} />
      </div>
      {children}
    </div>
  );
}

/**
 * Card for a tool gated by `needsApproval` on the server. The answer goes
 * through assistant-ui's respondToApproval, which the AI SDK runtime forwards
 * as addToolApprovalResponse to the job's agent.
 */
function ApprovalCard({
  approval,
  respondToApproval,
  title,
  detail,
  toolCallId,
}: Pick<ToolCallMessagePartProps, "approval" | "respondToApproval" | "toolCallId"> & {
  title: string;
  detail: ReactNode;
}) {
  const { canAct, owner } = useJobAccess();
  const record = useApprovalRecord(toolCallId);
  const decided = approval?.approved;
  const state = decided === undefined ? "open" : decided ? "yes" : "no";
  return (
    <div className={styles.approval} data-state={state}>
      <div className={styles.toolHead}>
        <span className={styles.toolIcon}>
          <ShieldQuestion size={13} />
        </span>
        <span className={styles.toolTitle}>{title}</span>
      </div>
      <div className={styles.approvalDetail}>{detail}</div>
      {decided === undefined && !canAct ? (
        <p className={styles.approvalResult}>Waiting for {whoCanAct(owner)} to approve.</p>
      ) : decided === undefined ? (
        <div className={styles.approvalActions}>
          <button className={styles.approve} onClick={() => respondToApproval({ approved: true })} type="button">
            Approve
          </button>
          <button className={styles.decline} onClick={() => respondToApproval({ approved: false })} type="button">
            Decline
          </button>
        </div>
      ) : (
        <p className={styles.approvalResult}>
          {decided ? "Approved" : "Declined"}
          {record && ` by ${record.by}`}
        </p>
      )}
    </div>
  );
}

/** Host and path only; full URLs with query strings are noisy in a one-line title. */
function shortUrl(url: unknown) {
  if (typeof url !== "string") {
    return null;
  }
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}

const WebFetch: ToolCallMessagePartComponent<{ url: string }, { status?: number }> = ({
  args,
  result,
  isError,
  approval,
  respondToApproval,
  toolCallId,
}) =>
  // Roles with connections ask before reading sites outside their allowed
  // sites. The whole URL is shown: a query string is where leaked data hides.
  approval && result === undefined && !isError ? (
    <ApprovalCard
        toolCallId={toolCallId}
      approval={approval}
      detail={<code className={styles.wrap}>{args.url}</code>}
      respondToApproval={respondToApproval}
      title="Read this page?"
    />
  ) : (
  <ToolFrame
    error={isError}
    icon={<Globe size={13} />}
    running={result === undefined && !isError}
    title={
      <>
        {isError ? "Could not read" : "Read"} <code>{shortUrl(args.url) ?? "a page"}</code>
      </>
    }
  />
);

const SendEmail: ToolCallMessagePartComponent<
  { to: string; subject: string; text: string },
  { sent: boolean }
> = ({ args, result, isError, approval, respondToApproval, toolCallId }) =>
  approval && result === undefined && !isError ? (
    <ApprovalCard
        toolCallId={toolCallId}
      approval={approval}
      detail={
        <>
          <strong>{args.subject}</strong> to {args.to}
          <span className={styles.wrap}>{args.text}</span>
        </>
      }
      respondToApproval={respondToApproval}
      title="Send this email?"
    />
  ) : (
    <ToolFrame
      error={isError}
      icon={<Mail size={13} />}
      running={result === undefined && !isError}
      title={
        <>
          {isError ? "Did not send to" : "Emailed"} <code>{args.to}</code>
        </>
      }
    />
  );

interface Screenshot {
  data: string;
  mediaType: string;
  type: "browser_screenshot";
}

/** The browser tool's run result can hold screenshots anywhere in what the model's code returned. */
function findScreenshots(value: unknown, found: Screenshot[] = [], depth = 0): Screenshot[] {
  if (!value || typeof value !== "object" || depth > 4) {
    return found;
  }
  const candidate = value as Partial<Screenshot>;
  if (candidate.type === "browser_screenshot" && typeof candidate.data === "string") {
    found.push(candidate as Screenshot);
    return found;
  }
  // The SDK redacts base64 nested in other data to a "[base64 ... omitted]" note.
  if (typeof value === "string") {
    return found;
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    findScreenshots(child, found, depth + 1);
  }
  return found;
}

const BrowserRun: ToolCallMessagePartComponent<
  { code: string },
  { status?: string; error?: string; result?: unknown; notice?: string }
> = ({ args, result, isError, approval, respondToApproval, toolCallId }) => {
  // With "Ask before every browser action" on, each run waits for approval.
  if (approval && result === undefined && !isError) {
    return (
      <ApprovalCard
        toolCallId={toolCallId}
        approval={approval}
        detail={<pre className={styles.pre}>{args.code}</pre>}
        respondToApproval={respondToApproval}
        title="Run this browser step?"
      />
    );
  }
  const failed = isError || result?.status === "error";
  const screenshots = findScreenshots(result?.result).filter((shot) => !shot.data.startsWith("[base64"));
  const redacted = JSON.stringify(result?.result ?? "").includes("data omitted");
  return (
    <ToolFrame
      error={failed}
      icon={<MonitorPlay size={13} />}
      running={result === undefined && !isError}
      title={failed ? "Browser step failed" : "Used the browser"}
    >
      {result?.notice && <p className={styles.approvalDetail}>{result.notice}</p>}
      {redacted && screenshots.length === 0 && (
        <p className={styles.approvalDetail}>A screenshot was taken but not kept, because it was returned with other data.</p>
      )}
      {screenshots.map((shot, i) => (
        <img
          alt={`Browser screenshot ${i + 1}`}
          className={styles.screenshot}
          // biome-ignore lint/suspicious/noArrayIndexKey: screenshots have no identity beyond position
          key={i}
          src={`data:${shot.mediaType};base64,${shot.data}`}
        />
      ))}
    </ToolFrame>
  );
};

interface LiveViewTab {
  liveViewUrl: string;
  pageUrl: string | null;
  title: string | null;
}

/**
 * The job asked a person to finish a browser step. Live View links are bearer
 * credentials that expire in about five minutes, so they are fetched on click
 * and never kept; the job continues when you reply in the composer.
 */
const RequestTakeover: ToolCallMessagePartComponent<{ reason: string }, unknown> = ({ args }) => {
  const job = useJobConnection();
  const access = useJobAccess();
  const [tabs, setTabs] = useState<LiveViewTab[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setError(null);
    try {
      const next = await job.call<LiveViewTab[]>("liveView", []);
      setTabs(next);
      if (next.length === 0) {
        setError("The browser has closed. Ask the job to open the page again.");
      } else if (next.length === 1 && next[0]) {
        window.open(next[0].liveViewUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className={styles.approval} data-state="open">
      <div className={styles.toolHead}>
        <span className={styles.toolIcon}>
          <Hand size={13} />
        </span>
        <span className={styles.toolTitle}>Take over the browser</span>
      </div>
      <p className={styles.approvalDetail}>{args.reason}</p>
      {access.canAct ? (
        <div className={styles.approvalActions}>
          <button className={styles.approve} onClick={open} type="button">
            Open browser <ExternalLink size={12} />
          </button>
        </div>
      ) : (
        <p className={styles.approvalResult}>Waiting for {whoCanAct(access.owner)} to take over.</p>
      )}
      {tabs && tabs.length > 1 && (
        <ul className={styles.rows}>
          {tabs.map((tab) => (
            <li key={tab.liveViewUrl}>
              <a href={tab.liveViewUrl} rel="noopener noreferrer" target="_blank">
                {tab.title || tab.pageUrl || "Tab"}
              </a>
            </li>
          ))}
        </ul>
      )}
      {error && <p className={styles.approvalResult}>{error}</p>}
      <p className={styles.approvalResult}>When you are done, reply below so the job can continue.</p>
    </div>
  );
};

/** Anything else: the tool name plus the URL when there is one. */
const Fallback: ToolCallMessagePartComponent = ({
  toolName,
  args,
  result,
  isError,
  approval,
  respondToApproval,
  toolCallId,
}) => {
  const url = shortUrl((args as { url?: unknown } | undefined)?.url);
  if (approval && result === undefined && !isError) {
    return (
      <ApprovalCard
        toolCallId={toolCallId}
        approval={approval}
        // Every argument, pretty-printed and wrapped, so an injected value
        // (a recipient, an id) is visible before approving. Connection tool
        // names start with their connection's name, e.g. linear_create_issue.
        detail={<code className={styles.wrap}>{JSON.stringify(args, null, 2)}</code>}
        respondToApproval={respondToApproval}
        title={`Run ${toolName}?`}
      />
    );
  }
  return (
    <ToolFrame
      error={isError}
      icon={url ? <Globe size={13} /> : <Sparkles size={13} />}
      running={result === undefined && !isError}
      title={
        <>
          {toolName} {url && <code>{url}</code>}
        </>
      }
    />
  );
};

/**
 * Once an approved call has run, its approval card gives way to the tool's
 * own row; this keeps who approved it (or declined it) underneath.
 */
function withApprover(Tool: ToolCallMessagePartComponent): ToolCallMessagePartComponent {
  const Wrapped: ToolCallMessagePartComponent = (props) => {
    const record = useApprovalRecord(props.toolCallId);
    const cardShowing = props.approval && props.result === undefined && !props.isError;
    return (
      <>
        <Tool {...props} />
        {record && !cardShowing && (
          <p className={styles.approvedBy}>
            {record.approved ? "Approved" : "Declined"} by {record.by}
          </p>
        )}
      </>
    );
  };
  return Wrapped;
}

export const sessionComponents: ComponentProps<typeof MessagePrimitive.Parts>["components"] = {
  Reasoning,
  Text,
  tools: {
    by_name: {
      browser: withApprover(BrowserRun as ToolCallMessagePartComponent),
      requestTakeover: RequestTakeover,
      sendEmail: withApprover(SendEmail as ToolCallMessagePartComponent),
      webFetch: withApprover(WebFetch as ToolCallMessagePartComponent),
    },
    Fallback: withApprover(Fallback),
  },
};
