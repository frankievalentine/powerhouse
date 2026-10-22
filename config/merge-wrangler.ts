import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const BASE = "wrangler.jsonc";
const LOCAL = "wrangler.local.jsonc";
/** Generated, gitignored. Live next to the base file so relative paths (main, assets) still resolve. */
const MERGED = "wrangler.merged.json";
const MERGED_DEV = "wrangler.dev.json";

type Config = Record<string, unknown>;

function readJsonc(path: string): Config {
  const { config, error } = ts.parseConfigFileTextToJson(path, readFileSync(path, "utf8"));
  if (error) {
    throw new Error(`${path}: ${ts.flattenDiagnosticMessageText(error.messageText, "\n")}`);
  }
  return config as Config;
}

/**
 * Returns the Wrangler config path to use: the base file when there is no
 * local overlay, otherwise a generated merge of the two. Top-level keys in the
 * overlay replace the base's, except `vars`, which merge key by key. Keeping
 * operator settings in the overlay means upstream changes to the base (new
 * migrations, bindings) are never lost in a stale copy.
 *
 * With `dev`, the Worker is named `<name>-dev`. Local dev reaches remote
 * bindings (Workers AI, the browser) through a preview session on the
 * Worker's workers.dev hostname, and the deployed hostname is behind Cloudflare
 * Access, which that session cannot pass. The preview session is temporary and
 * deploys nothing; only `vite build` and deploys use the real name. Dev writes
 * its own file so a build during dev never renames the running dev Worker.
 */
export function wranglerConfigPath(root: string, { dev = false }: { dev?: boolean } = {}) {
  const local = resolve(root, LOCAL);
  if (!existsSync(local) && !dev) {
    return resolve(root, BASE);
  }
  const base = readJsonc(resolve(root, BASE));
  const overlay = existsSync(local) ? readJsonc(local) : {};
  const merged: Config = {
    ...base,
    ...overlay,
    vars: { ...(base.vars as Config | undefined), ...(overlay.vars as Config | undefined) },
  };
  if (dev) {
    merged.name = `${merged.name}-dev`;
  }
  const out = resolve(root, dev ? MERGED_DEV : MERGED);
  writeFileSync(out, `${JSON.stringify(merged, null, 2)}\n`);
  return out;
}
