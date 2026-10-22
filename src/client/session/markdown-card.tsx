import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import { Check, Copy, Download, Maximize2, X } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useModal } from "../dialogs/use-modal";
import sheetStyles from "../dialogs/sheet.module.css";
import styles from "./live-session.module.css";

export const REMARK_PLUGINS = [remarkGfm];

/** Code blocks longer than this many lines start capped, with Expand. */
const CODE_LINES = 16;

/**
 * Images in model output render as links, never load: a reply can repeat
 * text injected by a fetched page or a connection, and an image URL that
 * loads on its own would send data out with no click (the CSP blocks it
 * too).
 */
export const MarkdownImage = ({ src, alt }: { src?: string | Blob; alt?: string }) =>
  typeof src === "string" && /^https?:/i.test(src) ? (
    <a href={src} rel="noopener noreferrer" target="_blank">
      {alt ? `Image: ${alt}` : "Image link"}
    </a>
  ) : (
    <span>{alt ? `[Image: ${alt}]` : "[Image]"}</span>
  );

function documentTitle(markdown: string) {
  const heading = /^#{1,3}\s+(.+?)\s*#*\s*$/m.exec(markdown);
  return heading?.[1]?.replace(/[*_`]/g, "") || "Document";
}

function fileName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "document"}.md`;
}

function download(markdown: string, name: string) {
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Denied or unavailable (an insecure origin); the button stays as it was.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className={styles.cardAction} onClick={() => void copy()} type="button">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}

function RenderedMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown components={{ img: MarkdownImage }} remarkPlugins={REMARK_PLUGINS}>
      {markdown}
    </ReactMarkdown>
  );
}

/** A document at a readable width, outside the narrow job window. */
function DocumentReader({ markdown, title, onClose }: { markdown: string; title: string; onClose: () => void }) {
  const { close, dialogProps } = useModal(onClose);
  return (
    <dialog {...dialogProps} aria-label={title} className={`${sheetStyles.dialog} ${styles.readerDialog}`}>
      <div className={sheetStyles.sheet}>
        <header className={sheetStyles.head}>
          <h2 className={sheetStyles.title}>{title}</h2>
          <span className={styles.readerActions}>
            <CopyButton text={markdown} />
            <button className={styles.cardAction} onClick={() => download(markdown, fileName(title))} type="button">
              <Download size={13} />
              .md
            </button>
            <button aria-label="Close" className={sheetStyles.iconButton} onClick={close} type="button">
              <X size={15} />
            </button>
          </span>
        </header>
        <div className={`${styles.text} ${styles.reader}`}>
          <RenderedMarkdown markdown={markdown} />
        </div>
      </div>
    </dialog>
  );
}

/**
 * A fenced markdown block, which is how jobs hand over documents: rendered,
 * on the transcript's surface, with its first lines showing.
 */
export function DocumentCard({ code }: SyntaxHighlighterProps) {
  const [expanded, setExpanded] = useState(false);
  const [reading, setReading] = useState(false);
  const title = documentTitle(code);
  const words = code.split(/\s+/).filter(Boolean).length;
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{title}</span>
        <span className={styles.cardMeta}>{words.toLocaleString()} words</span>
      </div>
      <Collapsible expanded={expanded} limit={220} onExpand={() => setExpanded(true)}>
        <div className={`${styles.text} ${styles.cardBody}`}>
          <RenderedMarkdown markdown={code} />
        </div>
      </Collapsible>
      <div className={styles.cardActions}>
        <button className={styles.cardAction} onClick={() => setReading(true)} type="button">
          <Maximize2 size={13} />
          Open
        </button>
        <CopyButton text={code} />
        <button className={styles.cardAction} onClick={() => download(code, fileName(title))} type="button">
          <Download size={13} />
          .md
        </button>
      </div>
      {reading && <DocumentReader markdown={code} onClose={() => setReading(false)} title={title} />}
    </div>
  );
}

/** Other fenced code: a header with the language and Copy, capped when long. */
export function CodeBlock({ code, language, components: { Pre, Code } }: SyntaxHighlighterProps) {
  const [expanded, setExpanded] = useState(false);
  const long = code.split("\n").length > CODE_LINES;
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHead}>
        <span>{language && language !== "unknown" ? language : "code"}</span>
        <span className={styles.readerActions}>
          {long && (
            <button className={styles.cardAction} onClick={() => setExpanded((e) => !e)} type="button">
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
          <CopyButton text={code} />
        </span>
      </div>
      <Pre className={styles.codePre} data-capped={(long && !expanded) || undefined}>
        <Code>{code}</Code>
      </Pre>
    </div>
  );
}

/**
 * Caps its content at `limit` pixels with a fade and "Show all" when it is
 * taller; otherwise shows it as it is.
 */
export function Collapsible({
  children,
  limit,
  expanded,
  onExpand,
}: {
  children: ReactNode;
  limit: number;
  expanded: boolean;
  onExpand: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const measure = () => setOverflows(el.scrollHeight > limit + 40);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [limit]);
  const capped = overflows && !expanded;
  return (
    <div className={styles.collapsible} data-capped={capped || undefined}>
      <div ref={ref} style={capped ? { maxHeight: limit } : undefined}>
        {children}
      </div>
      {capped && (
        <button className={styles.showAll} onClick={onExpand} type="button">
          Show all
        </button>
      )}
    </div>
  );
}
