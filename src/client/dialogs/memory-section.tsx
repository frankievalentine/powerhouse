import { useCallback, useEffect, useState } from "react";
import { MEMORY_LIMITS, type MemoryInfo } from "../../shared";
import { formatAgo } from "../lib/time";
import { useOrg } from "../org/org-context";
import styles from "./sheet.module.css";

type Draft = { id?: string; title: string; content: string };

/**
 * Team memory: notes every job can look up. Jobs propose notes; an admin
 * approves, edits or rejects them here, and can write notes directly.
 * Members see the notes but cannot change them.
 */
export function MemorySection() {
  const { approveMemory, deleteMemory, isAdmin, listMemories, saveMemory, state } = useOrg();
  const [notes, setNotes] = useState<MemoryInfo[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();

  const load = useCallback(() => listMemories().then(setNotes, (e: Error) => setError(e.message)), [listMemories]);
  // A job proposing a note changes the count, so the review list stays current.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloads when proposals change
  useEffect(() => {
    void load();
  }, [load, state.memoryProposals]);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (draft && (await act(() => saveMemory(draft)))) {
      setDraft(null);
    }
  };

  const proposals = notes?.filter((n) => n.status === "proposed") ?? [];
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const approved = (notes ?? []).filter(
    (n) => n.status === "approved" && words.every((w) => `${n.title} ${n.content}`.toLowerCase().includes(w)),
  );
  const approvedCount = notes?.filter((n) => n.status === "approved").length ?? 0;

  const editor = (
    <div className={styles.field}>
      <input
        aria-label="Title"
        className={styles.input}
        maxLength={MEMORY_LIMITS.title}
        onChange={(e) => setDraft((d) => d && { ...d, title: e.target.value })}
        placeholder="Title (optional)"
        value={draft?.title ?? ""}
      />
      <textarea
        aria-label="Note"
        className={styles.textarea}
        maxLength={MEMORY_LIMITS.content}
        onChange={(e) => setDraft((d) => d && { ...d, content: e.target.value })}
        placeholder="Something every job should know: a decision, a contact, a product fact, a preference."
        rows={3}
        value={draft?.content ?? ""}
      />
      <div className={styles.actions}>
        <button className={styles.primary} disabled={busy || !draft?.content.trim()} onClick={() => void save()} type="button">
          {draft?.id ? "Save and approve" : "Add note"}
        </button>
        <button className={styles.secondary} disabled={busy} onClick={() => setDraft(null)} type="button">
          Cancel
        </button>
      </div>
    </div>
  );

  const item = (note: MemoryInfo) =>
    draft?.id === note.id ? (
      <li className={styles.checkItem} key={note.id}>
        {editor}
      </li>
    ) : (
      <li className={styles.checkItem} data-status={note.status === "approved" ? "on" : "off"} key={note.id}>
        <div className={styles.checkHead}>
          <span className={styles.checkLabel}>{note.title}</span>
          {note.status === "proposed" && <span className={styles.checkStatus}>To review</span>}
        </div>
        <p className={styles.noteText}>{note.content}</p>
        <p className={styles.hint}>
          {note.status === "proposed"
            ? `Proposed by ${note.proposedBy}'s job ${formatAgo(note.createdAt, now)}`
            : `Approved by ${note.approvedBy ?? "an admin"} · updated ${formatAgo(note.updatedAt, now)}`}
        </p>
        {isAdmin && (
          <div className={styles.actions}>
            {note.status === "proposed" && (
              <button className={styles.primary} disabled={busy} onClick={() => void act(() => approveMemory(note.id))} type="button">
                Approve
              </button>
            )}
            <button
              className={styles.secondary}
              disabled={busy}
              onClick={() => setDraft({ content: note.content, id: note.id, title: note.title })}
              type="button"
            >
              Edit
            </button>
            <button className={styles.secondary} disabled={busy} onClick={() => void act(() => deleteMemory(note.id))} type="button">
              {note.status === "proposed" ? "Reject" : "Delete"}
            </button>
          </div>
        )}
      </li>
    );

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Team memory</h3>
      <p className={styles.hint}>
        Notes every job can look up: decisions, contacts, product facts, preferences. Jobs propose notes when you tell them
        something worth keeping; only approved notes reach jobs, and only admins approve. {approvedCount} of{" "}
        {MEMORY_LIMITS.approved} notes used.
      </p>
      {!notes && !error && <p className={styles.muted}>Loading...</p>}
      {proposals.length > 0 && (
        <>
          <p className={styles.label}>To review ({proposals.length})</p>
          <ul className={styles.checklist}>{proposals.map(item)}</ul>
        </>
      )}
      {isAdmin &&
        (draft && !draft.id ? (
          editor
        ) : (
          <div className={styles.actions}>
            <button className={styles.secondary} disabled={busy} onClick={() => setDraft({ content: "", title: "" })} type="button">
              Add a note
            </button>
          </div>
        ))}
      {approvedCount > 5 && (
        <input
          aria-label="Filter notes"
          className={styles.input}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter notes"
          value={filter}
        />
      )}
      {notes && approvedCount === 0 && <p className={styles.muted}>No notes yet.</p>}
      <ul className={styles.checklist}>{approved.map(item)}</ul>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
