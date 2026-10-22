import {
  AUTO_MODEL,
  MODELS,
  ROLE_LIMITS,
  type RoleConfig,
  type RoleTemplate,
  type SkillInfo,
  TOOL_IDS,
  TOOL_INFO,
  type ToolId,
} from "../../shared";
import { ChevronRight, Plus, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { autoModelLabel, ModelOptions } from "../components/model-options";
import { type RoleDraft, useOrg } from "../org/org-context";
import styles from "./sheet.module.css";
import { useModal } from "./use-modal";

/** Role colors as OKLCH hues: evenly spread, so roles stay easy to tell apart. */
const ROLE_HUES = [0, 30, 60, 90, 130, 165, 195, 220, 245, 270, 300, 330];

const NEW_ROLE: RoleDraft = {
  allowedHosts: [],
  connections: [],
  hue: 195,
  model: null,
  name: "",
  purpose: "",
  skills: [],
  suggestions: [],
  systemPrompt: "",
  tools: ["webFetch"],
};

const lines = (value: string) =>
  value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Create, edit and delete the org's roles. Saving goes through Org.saveRole,
 * which validates on the server; jobs already running keep the role they
 * were dispatched with.
 */
export function RolesSheet({ onClose }: { onClose: () => void }) {
  const { dialogProps, close } = useModal(onClose);
  const { listRoles, listLibrary, addFromLibrary } = useOrg();
  const [tab, setTab] = useState<"roles" | "library">("roles");
  const [roles, setRoles] = useState<RoleConfig[] | null>(null);
  const [library, setLibrary] = useState<RoleTemplate[] | null>(null);
  const [editing, setEditing] = useState<RoleDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      listRoles().then(setRoles, (e: Error) => setLoadError(e.message)),
    [listRoles],
  );

  useEffect(() => {
    void reload();
    listLibrary().then(setLibrary, (e: Error) => setLoadError(e.message));
  }, [reload, listLibrary]);

  // Adding a template copies it into the org's roles and opens the copy, since
  // most templates want their allowed sites or instructions adjusted.
  const add = async (templateId: string) => {
    setAdding(templateId);
    setLoadError(null);
    try {
      const role = await addFromLibrary(templateId);
      await reload();
      setTab("roles");
      setEditing(role);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(null);
    }
  };

  return (
    <dialog {...dialogProps} aria-label="Roles" className={styles.dialog}>
      <div className={styles.sheet}>
        <header className={styles.head}>
          {editing ? (
            <button className={styles.textButton} onClick={() => setEditing(null)} type="button">
              All roles
            </button>
          ) : (
            <h2 className={styles.title}>Roles</h2>
          )}
          <button aria-label="Close" className={styles.iconButton} onClick={close} type="button">
            <X size={15} />
          </button>
        </header>

        {editing ? (
          <RoleEditor
            canDelete={(roles?.length ?? 0) > 1}
            draft={editing}
            onDone={() => {
              setEditing(null);
              void reload();
            }}
          />
        ) : (
          <div className={styles.body}>
            <div aria-label="Roles views" className={styles.tabs} role="tablist">
              <button
                aria-selected={tab === "roles"}
                className={styles.tab}
                onClick={() => setTab("roles")}
                role="tab"
                type="button"
              >
                Your roles
              </button>
              <button
                aria-selected={tab === "library"}
                className={styles.tab}
                onClick={() => setTab("library")}
                role="tab"
                type="button"
              >
                Library
              </button>
            </div>
            {loadError && <p className={styles.error}>{loadError}</p>}
            {tab === "library" ? (
              <LibraryList adding={adding} onAdd={(id) => void add(id)} templates={library} />
            ) : (
              <RoleList onEdit={setEditing} roles={roles} showLoading={!(roles || loadError)} />
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}

function SkillOption({
  skill,
  checked,
  atLimit,
  suggested = false,
  onToggle,
}: {
  skill: SkillInfo;
  checked: boolean;
  atLimit: boolean;
  suggested?: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={styles.tool}>
      <input checked={checked} disabled={!checked && atLimit} onChange={onToggle} type="checkbox" />
      <span>
        <span className={styles.toolName}>
          {skill.name}
          {suggested && <span className={styles.badge}>Suggested</span>}
        </span>
        <span className={`${styles.hint} ${styles.clamp}`} title={skill.description}>
          {skill.description}
        </span>
        {skill.source && (
          <span className={styles.hint}>
            From {skill.source}
            {skill.license ? ` (${skill.license})` : ""}
          </span>
        )}
      </span>
    </label>
  );
}

function RoleList({
  roles,
  showLoading,
  onEdit,
}: {
  roles: RoleConfig[] | null;
  showLoading: boolean;
  onEdit: (draft: RoleDraft) => void;
}) {
  const { isAdmin } = useOrg();
  return (
    <>
      {showLoading && <p className={styles.muted}>Loading...</p>}
      <ul className={styles.list}>
        {roles?.map((role) => (
          <li key={role.id}>
            <button
              className={styles.row}
              onClick={() => onEdit(role)}
              style={{ ["--dept-hue" as string]: role.hue }}
              type="button"
            >
              <span className={styles.swatch} />
              <span className={styles.rowText}>
                <span className={styles.rowName}>{role.name}</span>
                <span className={styles.rowPurpose}>{role.purpose}</span>
                <span className={styles.rowTools}>
                  {role.tools.length ? role.tools.map((t) => TOOL_INFO[t].label).join(" / ") : "No tools"}
                </span>
              </span>
              <ChevronRight className={styles.chevron} size={15} />
            </button>
          </li>
        ))}
      </ul>
      {isAdmin && (
        <button className={styles.primary} onClick={() => onEdit(NEW_ROLE)} type="button">
          <Plus size={14} /> New role
        </button>
      )}
    </>
  );
}

function LibraryList({
  templates,
  adding,
  onAdd,
}: {
  templates: RoleTemplate[] | null;
  adding: string | null;
  onAdd: (templateId: string) => void;
}) {
  const { isAdmin, state } = useOrg();
  return (
    <>
      <p className={styles.muted}>
        Ready-made roles. Adding one copies it into your roles for you to edit; tools this deployment has not configured
        stay off until you set them up.
      </p>
      <ul className={styles.list}>
        {templates?.map((template) => (
          <li className={styles.row} data-static key={template.id}>
            <span className={styles.rowText}>
              <span className={styles.rowName}>{template.name}</span>
              <span className={styles.rowPurpose}>{template.purpose}</span>
              <span className={styles.rowTools}>
                {template.tools
                  .map((t) => `${TOOL_INFO[t].label}${state.capabilities[t] ? "" : " (not configured)"}`)
                  .join(" / ")}
              </span>
            </span>
            <button className={styles.secondary} disabled={adding !== null || !isAdmin} onClick={() => onAdd(template.id)} type="button">
              {adding === template.id ? "Adding..." : "Add"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function RoleEditor({
  draft,
  canDelete,
  onDone,
}: {
  draft: RoleDraft;
  canDelete: boolean;
  onDone: () => void;
}) {
  const { saveRole, deleteRole, listSkills, state, suggestSkills, isAdmin } = useOrg();
  const [name, setName] = useState(draft.name);
  const [purpose, setPurpose] = useState(draft.purpose);
  const [hue, setHue] = useState(draft.hue);
  const [model, setModel] = useState<string | null>(draft.model);
  const [systemPrompt, setSystemPrompt] = useState(draft.systemPrompt);
  const [tools, setTools] = useState<ToolId[]>(draft.tools);
  const [skills, setSkills] = useState<string[]>(draft.skills);
  const [connections, setConnections] = useState<string[]>(draft.connections);
  const [catalog, setCatalog] = useState<SkillInfo[] | null>(null);
  const [hosts, setHosts] = useState(draft.allowedHosts.join("\n"));
  const [suggestions, setSuggestions] = useState(draft.suggestions.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !draft.id;

  useEffect(() => {
    listSkills().then(setCatalog, () => setCatalog([]));
  }, [listSkills]);

  const toggleTool = (id: ToolId) =>
    setTools((current) => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]));
  const toggleSkill = (name: string) =>
    setSkills((current) => (current.includes(name) ? current.filter((s) => s !== name) : [...current, name]));
  // Skills on the role that are no longer bundled stay listed so they can be removed.
  const missingSkills = catalog ? skills.filter((name) => !catalog.some((s) => s.name === name)) : [];

  // Suggestions from the Clef decision model, for the role as described.
  // Fetched when the editor opens and when the purpose is edited; the
  // role's own skills always come first.
  const [suggested, setSuggested] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const suggestFor = useCallback(
    (forPurpose: string) => {
      if (!forPurpose.trim()) {
        setSuggested([]);
        return;
      }
      setSuggesting(true);
      suggestSkills({ name, purpose: forPurpose })
        .then(setSuggested, () => setSuggested([]))
        .finally(() => setSuggesting(false));
    },
    [name, suggestSkills],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: suggestions load once on open; edits reload on blur
  useEffect(() => {
    suggestFor(draft.purpose);
  }, []);
  // The order is fixed when the role is opened (its skills, then suggestions),
  // so ticking a box does not move it to another list.
  const pinned = useRef<string[]>(draft.skills);
  const recommendedNames = [...new Set([...pinned.current, ...suggested])];
  const recommended = (catalog ?? []).filter((s) => recommendedNames.includes(s.name));
  recommended.sort((a, b) => recommendedNames.indexOf(a.name) - recommendedNames.indexOf(b.name));
  const others = (catalog ?? []).filter((s) => !recommendedNames.includes(s.name));
  const toggleConnection = (id: string) =>
    setConnections((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  // Removed connections stay listed so they can be unticked; jobs skip them either way.
  const removedConnections = connections.filter((id) => !state.connections.some((c) => c.id === id));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveRole({
        allowedHosts: lines(hosts),
        connections,
        hue,
        id: draft.id,
        model,
        name,
        purpose,
        skills,
        suggestions: lines(suggestions),
        systemPrompt,
        tools,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft.id) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteRole(draft.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <form className={styles.body} onSubmit={submit} style={{ ["--dept-hue" as string]: hue }}>
      {!isAdmin && <p className={styles.notice}>You can see this role; only admins can change it.</p>}
      <fieldset className={styles.plainFieldset} disabled={!isAdmin}>
      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <input
          className={styles.input}
          maxLength={ROLE_LIMITS.name}
          onChange={(e) => setName(e.target.value)}
          required
          value={name}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Purpose</span>
        <span className={styles.hint}>Shown to people and used by the router to pick this role.</span>
        <input
          className={styles.input}
          maxLength={ROLE_LIMITS.purpose}
          onBlur={() => purpose !== draft.purpose && suggestFor(purpose)}
          onChange={(e) => setPurpose(e.target.value)}
          required
          value={purpose}
        />
      </label>

      <fieldset className={styles.field}>
        <legend className={styles.label}>Color</legend>
        <div aria-label="Color" className={styles.colors} role="radiogroup">
          {/* A color saved before the palette existed stays selectable as it was. */}
          {(ROLE_HUES.includes(hue) ? ROLE_HUES : [hue, ...ROLE_HUES]).map((value) => (
            <button
              aria-checked={value === hue}
              aria-label={`Color ${value}`}
              className={styles.colorSwatch}
              key={value}
              onClick={() => setHue(value)}
              role="radio"
              style={{ ["--dept-hue" as string]: value }}
              type="button"
            />
          ))}
        </div>
      </fieldset>

      <label className={styles.field}>
        <span className={styles.label}>Instructions</span>
        <span className={styles.hint}>The system prompt every job for this role starts with.</span>
        <textarea
          className={styles.textarea}
          maxLength={ROLE_LIMITS.systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          required
          rows={6}
          value={systemPrompt}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Model</span>
        <span className={styles.hint}>The model this role's jobs run on.</span>
        <select className={styles.input} onChange={(e) => setModel(e.target.value || null)} value={model ?? ""}>
          <option value="">
            Org default (
            {state.settings.jobModel === AUTO_MODEL
              ? `Automatic, ${autoModelLabel(state.providers)}`
              : (MODELS.find((m) => m.id === state.settings.jobModel)?.label ?? state.settings.jobModel)}
            )
          </option>
          <ModelOptions providers={state.providers} />
        </select>
      </label>

      <fieldset className={styles.field}>
        <legend className={styles.label}>Tools</legend>
        {TOOL_IDS.map((id) => {
          const available = state.capabilities[id];
          return (
            <label className={styles.tool} data-unavailable={!available || undefined} key={id}>
              <input
                checked={tools.includes(id)}
                // A granted tool stays uncheckable even when unavailable, so it can be removed.
                disabled={!(available || tools.includes(id))}
                onChange={() => toggleTool(id)}
                type="checkbox"
              />
              <span>
                <span className={styles.toolName}>
                  {TOOL_INFO[id].label}
                  {!available && <span className={styles.badge}>Not configured</span>}
                </span>
                <span className={styles.hint}>{TOOL_INFO[id].description}</span>
                {!available && TOOL_INFO[id].setup && <span className={styles.hint}>{TOOL_INFO[id].setup}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className={styles.field}>
        <legend className={styles.label}>Connections</legend>
        <span className={styles.hint}>
          Connected accounts this role's jobs may use, up to {ROLE_LIMITS.connections}. Tools that change anything wait
          for approval. Add connections in Settings.
        </span>
        {state.connections.length === 0 && removedConnections.length === 0 && (
          <span className={styles.hint}>No connections yet.</span>
        )}
        {state.connections.map((connection) => (
          <label className={styles.tool} key={connection.id}>
            <input
              checked={connections.includes(connection.id)}
              disabled={!connections.includes(connection.id) && connections.length >= ROLE_LIMITS.connections}
              onChange={() => toggleConnection(connection.id)}
              type="checkbox"
            />
            <span>
              <span className={styles.toolName}>{connection.name}</span>
              <span className={styles.hint}>{connection.url}</span>
            </span>
          </label>
        ))}
        {removedConnections.map((id) => (
          <label className={styles.tool} data-unavailable key={id}>
            <input checked onChange={() => toggleConnection(id)} type="checkbox" />
            <span>
              <span className={styles.toolName}>
                Removed connection
                <span className={styles.badge}>Removed</span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.field}>
        <legend className={styles.label}>Skills</legend>
        <span className={styles.hint}>
          Expert instructions this role loads when a job calls for them, up to {ROLE_LIMITS.skills}. Only their names and
          descriptions are in every prompt.
        </span>
        {!catalog && <span className={styles.hint}>Loading skills...</span>}
        {catalog?.length === 0 && <span className={styles.hint}>No skills are bundled with this deployment.</span>}
        {catalog && catalog.length > 0 && (
          <>
            <span className={styles.subLabel}>Recommended for this role</span>
            {recommended.map((skill) => (
              <SkillOption
                atLimit={skills.length >= ROLE_LIMITS.skills}
                checked={skills.includes(skill.name)}
                key={skill.name}
                onToggle={() => toggleSkill(skill.name)}
                skill={skill}
                suggested={!skills.includes(skill.name)}
              />
            ))}
            {suggesting && <span className={styles.hint}>Finding skills that suit this role...</span>}
            {!suggesting && recommended.length === 0 && (
              <span className={styles.hint}>
                {purpose.trim() ? "No skill stands out for this role. Browse them all below." : "Describe the role's purpose to get suggestions."}
              </span>
            )}
            <details className={styles.disclosure}>
              <summary>All skills ({others.length} more)</summary>
              {others.map((skill) => (
                <SkillOption
                  atLimit={skills.length >= ROLE_LIMITS.skills}
                  checked={skills.includes(skill.name)}
                  key={skill.name}
                  onToggle={() => toggleSkill(skill.name)}
                  skill={skill}
                />
              ))}
            </details>
          </>
        )}
        {missingSkills.map((name) => (
          <label className={styles.tool} data-unavailable key={name}>
            <input checked onChange={() => toggleSkill(name)} type="checkbox" />
            <span>
              <span className={styles.toolName}>
                {name}
                <span className={styles.badge}>No longer bundled</span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {(tools.includes("webFetch") || tools.includes("browser")) && (
        <label className={styles.field}>
          <span className={styles.label}>Allowed sites</span>
          <span className={styles.hint}>
            Sites this role may read and browse, one per line, like docs.example.com or *.example.com (subdomains
            only; add example.com separately). Leave empty to allow any public site, which also lets a misled job
            send data to any site in a URL.
          </span>
          <textarea
            className={styles.textarea}
            onChange={(e) => setHosts(e.target.value)}
            placeholder="developers.cloudflare.com"
            rows={3}
            value={hosts}
          />
        </label>
      )}

      <label className={styles.field}>
        <span className={styles.label}>Suggestions</span>
        <span className={styles.hint}>
          Up to {ROLE_LIMITS.suggestions}, one per line; the first that can run shows on the home page. Start a line with
          [web search], [browser] or [email] to show it only when that tool is on, and use {"{website}"} or {"{me}"} for
          the website and your email.
        </span>
        <textarea
          className={styles.textarea}
          onChange={(e) => setSuggestions(e.target.value)}
          rows={3}
          value={suggestions}
        />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      </fieldset>
      {isAdmin && (
      <div className={styles.actions}>
        <button className={styles.primary} disabled={busy} type="submit">
          {isNew ? "Create role" : "Save"}
        </button>
        {!isNew &&
          canDelete &&
          (confirmDelete ? (
            <button className={styles.danger} disabled={busy} onClick={remove} type="button">
              Delete {draft.name}?
            </button>
          ) : (
            <button className={styles.textButton} onClick={() => setConfirmDelete(true)} type="button">
              Delete role
            </button>
          ))}
      </div>
      )}
    </form>
  );
}
