// Vendors the Agent Skills listed in skills.lock.json into skills/<name>/,
// each pinned to an upstream commit. Only the skill's instructions and
// references are kept: jobs never run skill scripts, and evals are upstream
// test material.
//
// The Agents Vite plugin only bundles a skill's files under references/ and
// assets/ (scripts/ too, which jobs do not use), so other files and folders
// (examples/, top-level guides) move under references/ and SKILL.md's paths
// are rewritten to match.
//
// Jobs can fetch URLs, so text that can change after review is cut from
// every markdown file: links to a GitHub branch (blob/main) keep their text
// but lose the URL, sponsored-partner marks go, and "Related Skills" sections
// (naming skills we may not bundle) are removed, as are any sections a lock
// entry lists in stripSections.
//
// Each skill's nearest LICENSE and NOTICE go to skills-licenses/<name>/,
// outside the bundle, with a CHANGES.md listing every change, as the
// Apache-2.0 license requires.
//
//   bun run skills:sync            fetch exactly the pinned commits
//   bun run skills:sync --update   move every pin to its repo's latest commit

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

interface LockEntry {
  /** The skill's frontmatter name, which is also its folder under skills/. */
  name: string;
  /** GitHub owner/repo. */
  repo: string;
  /** The skill's folder within the repo. */
  path: string;
  commit: string;
  /** SPDX id, checked by hand when the skill is added. */
  license: string;
  /** Headings (without the #s) of sections to remove, found in the hand review. */
  stripSections?: string[];
}

const APP = resolve(import.meta.dirname, "..");
const LOCK = join(APP, "skills.lock.json");
const SKILLS = join(APP, "skills");
const LICENSES = join(APP, "skills-licenses");
/** Credits in skills-licenses/ for material that is not a vendored skill. */
const OTHER_CREDITS = new Set(["i-have-adhd"]);
/** Top-level entries the plugin bundles as they are. */
const BUNDLED_ROOTS = new Set(["SKILL.md", "references", "assets"]);
const LICENSE_FILE = /^(LICENSE|NOTICE|COPYING)/i;
/** Folders never vendored, at any depth of the skill. */
const EXCLUDED = new Set(["evals", "scripts", ".github"]);
/** Removed from every vendored skill; see the header comment. */
const ALWAYS_STRIPPED = ["Related Skills"];
/** A markdown link to a file on a GitHub branch, which can change after review. */
const BRANCH_LINK = /\[([^\]]+)\]\(https:\/\/(?:github\.com\/[^/)\s]+\/[^/)\s]+\/(?:blob|tree)|raw\.githubusercontent\.com\/[^/)\s]+\/[^/)\s]+)\/(?:main|master|HEAD)\/[^)\s]*\)/g;

const lock = JSON.parse(readFileSync(LOCK, "utf8")) as { skills: LockEntry[] };
const update = process.argv.includes("--update");

function git(args: string[], cwd?: string) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stderr}`);
  }
  return result.stdout.trim();
}

if (update) {
  for (const repo of new Set(lock.skills.map((s) => s.repo))) {
    const head = git(["ls-remote", `https://github.com/${repo}`, "HEAD"]).split(/\s+/)[0];
    if (!head) {
      throw new Error(`Could not read the latest commit of ${repo}`);
    }
    for (const entry of lock.skills.filter((s) => s.repo === repo)) {
      entry.commit = head;
    }
  }
  writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
}

/** One sparse, shallow checkout per repo and commit. */
const checkouts = new Map<string, string>();
function checkout(repo: string, commit: string, paths: string[]) {
  const key = `${repo}@${commit}`;
  const existing = checkouts.get(key);
  if (existing) {
    return existing;
  }
  const dir = mkdtempSync(join(tmpdir(), "powerhouse-skills-"));
  git(["init", "--quiet"], dir);
  // Each skill folder plus the license files of every folder above it.
  const licensePatterns = new Set(["/LICENSE*", "/NOTICE*"]);
  for (const path of paths) {
    const parts = path.split("/");
    for (let depth = 1; depth < parts.length; depth++) {
      const parent = parts.slice(0, depth).join("/");
      licensePatterns.add(`/${parent}/LICENSE*`).add(`/${parent}/NOTICE*`);
    }
  }
  git(["sparse-checkout", "set", "--no-cone", ...paths.map((p) => `/${p}/`), ...licensePatterns], dir);
  git(["fetch", "--quiet", "--depth", "1", `https://github.com/${repo}`, commit], dir);
  git(["-c", "advice.detachedHead=false", "checkout", "--quiet", "FETCH_HEAD"], dir);
  checkouts.set(key, dir);
  return dir;
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Removes a markdown section: its heading line through the next heading of the same or a higher level. */
function stripSection(text: string, heading: string) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => new RegExp(`^#{1,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`).test(line));
  if (start === -1) {
    return text;
  }
  const level = /^#+/.exec(lines[start] as string)?.[0].length ?? 1;
  let end = start + 1;
  while (end < lines.length && !(/^#+\s/.test(lines[end] as string) && (/^#+/.exec(lines[end] as string)?.[0].length ?? 7) <= level)) {
    end++;
  }
  lines.splice(start, end - start);
  return lines.join("\n");
}

function frontmatterName(skillMd: string) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd)?.[1] ?? "";
  return /^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(frontmatter)?.[1] ?? null;
}

try {
  for (const entry of lock.skills) {
    const paths = lock.skills.filter((s) => s.repo === entry.repo && s.commit === entry.commit).map((s) => s.path);
    const repoDir = checkout(entry.repo, entry.commit, paths);
    const source = join(repoDir, entry.path);
    const skillMd = join(source, "SKILL.md");
    if (!existsSync(skillMd)) {
      throw new Error(`${entry.repo}/${entry.path} has no SKILL.md at ${entry.commit}`);
    }
    const declared = frontmatterName(readFileSync(skillMd, "utf8"));
    if (declared !== entry.name) {
      throw new Error(`${entry.repo}/${entry.path} is named "${declared}" in its SKILL.md, not "${entry.name}"`);
    }
    const target = join(SKILLS, entry.name);
    const licenses = join(LICENSES, entry.name);
    rmSync(target, { force: true, recursive: true });
    rmSync(licenses, { force: true, recursive: true });
    cpSync(source, target, { filter: (path) => !EXCLUDED.has(basename(path)), recursive: true });
    mkdirSync(licenses, { recursive: true });

    // The skill's own license, else the nearest one above it (a plugin
    // folder's, then the repo's).
    let licenseDir = target;
    let foundAt = source;
    for (let dir = source; ; dir = dirname(dir)) {
      if (readdirSync(dir).some((file) => LICENSE_FILE.test(file))) {
        licenseDir = dir === source ? target : dir;
        foundAt = dir;
        break;
      }
      if (dir === repoDir) {
        throw new Error(`${entry.repo}/${entry.path} has no license file at or above it`);
      }
    }
    for (const file of readdirSync(licenseDir).filter((f) => LICENSE_FILE.test(f))) {
      cpSync(join(licenseDir, file), join(licenses, file));
      if (licenseDir === target) {
        rmSync(join(target, file));
      }
    }
    // A NOTICE further up still applies (Apache-2.0 section 4d), so keep
    // walking to the repo root; the nearest copy of each file name wins.
    for (let dir = foundAt; dir !== repoDir; ) {
      dir = dirname(dir);
      for (const file of readdirSync(dir).filter((f) => /^NOTICE/i.test(f))) {
        if (!existsSync(join(licenses, file))) {
          cpSync(join(dir, file), join(licenses, file));
        }
      }
    }

    const changes: string[] = [];
    let skillText = readFileSync(join(target, "SKILL.md"), "utf8");
    for (const item of readdirSync(target)) {
      if (BUNDLED_ROOTS.has(item)) {
        continue;
      }
      mkdirSync(join(target, "references"), { recursive: true });
      if (existsSync(join(target, "references", item))) {
        throw new Error(`${entry.name}: both ${item} and references/${item} exist; move it by hand`);
      }
      renameSync(join(target, item), join(target, "references", item));
      // Rewrite path mentions (examples/x.md, ./guide.md, `guide.md`), not
      // words that happen to share the name.
      const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      skillText = skillText.replace(new RegExp(`(^|[\\s(\\[\`'"])(\\./)?${escaped}(?=/|[\\s)\\]\`'".,:;]|$)`, "gm"), `$1references/${item}`);
      changes.push(`Moved \`${item}\` to \`references/${item}\` and updated its paths in SKILL.md.`);
    }
    writeFileSync(join(target, "SKILL.md"), skillText);

    const sections = [...ALWAYS_STRIPPED, ...(entry.stripSections ?? [])];
    for (const file of markdownFiles(target)) {
      const original = readFileSync(file, "utf8");
      const relative = file.slice(target.length + 1);
      let text = original;
      for (const heading of sections) {
        const stripped = stripSection(text, heading);
        if (stripped !== text) {
          changes.push(`Removed the "${heading}" section from \`${relative}\`.`);
          text = stripped;
        }
      }
      const unlinked = text.replace(BRANCH_LINK, "$1");
      if (unlinked !== text) {
        changes.push(`Removed links to files on a GitHub branch from \`${relative}\`, keeping their text.`);
        text = unlinked;
      }
      const unsponsored = text
        .split("\n")
        .filter((line) => !/Verified Partner/.test(line))
        .join("\n")
        .replace(/ ?◆/g, "");
      if (unsponsored !== text) {
        changes.push(`Removed sponsored-partner marks from \`${relative}\`.`);
        text = unsponsored;
      }
      if (text !== original) {
        writeFileSync(file, text);
      }
    }
    for (const heading of entry.stripSections ?? []) {
      if (!changes.some((c) => c.includes(`"${heading}"`))) {
        throw new Error(`${entry.name}: no "${heading}" section to strip; update stripSections`);
      }
    }
    if (changes.length > 0) {
      writeFileSync(
        join(licenses, "CHANGES.md"),
        `# Changes by powerhouse\n\nModified from ${entry.repo}@${entry.commit} (${entry.path}):\n\n${changes.map((c) => `- ${c}`).join("\n")}\n`,
      );
    }
    console.log(`${entry.name}: ${entry.repo}@${entry.commit.slice(0, 12)} (${entry.license})`);
  }
  const wanted = new Set([...lock.skills.map((s) => s.name), ...OTHER_CREDITS]);
  for (const root of [SKILLS, LICENSES]) {
    for (const dir of readdirSync(root, { withFileTypes: true })) {
      if (dir.isDirectory() && !wanted.has(dir.name)) {
        rmSync(join(root, dir.name), { recursive: true });
        console.log(`${dir.name}: removed from ${basename(root)}/ (no longer in skills.lock.json)`);
      }
    }
  }
} finally {
  for (const dir of checkouts.values()) {
    rmSync(dir, { force: true, recursive: true });
  }
}
