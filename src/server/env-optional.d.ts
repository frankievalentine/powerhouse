// Optional bindings live in wrangler.local.jsonc, not the base config that
// env.d.ts is generated from, so declare them here as possibly absent and
// check for them at runtime (see capabilities.ts). env.d.ts declares Env both
// globally and under Cloudflare, so both are augmented.
/** The app version from package.json, injected by vite.config.ts (both builds). */
declare const __APP_VERSION__: string;

interface OptionalBindings {
  /**
   * Cloudflare Access, as setup.mjs writes it: team domain
   * (https://<team>.cloudflareaccess.com) and the application's AUD tag.
   * Absent on deployments set up in the browser (see deployment.ts).
   */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  BROWSER?: BrowserRun;
  EMAIL?: SendEmail;
  EMAIL_FROM?: string;
  LOADER?: WorkerLoader;
  /** Admins named by setup (comma-separated emails); always admins, so the org cannot be locked out. */
  ADMIN_EMAILS?: string;
  /** The AI Gateway that vendor models (Claude, GPT) go through; written by setup.mjs. */
  AI_GATEWAY_ID?: string;
  /**
   * Vendors set up on that gateway, comma-separated ("anthropic,openai"):
   * a stored key for each, or Unified Billing credits, which cover both.
   */
  AI_PROVIDERS?: string;
  /** "on" or "off": whether the gateway had spend limits when setup last checked. */
  AI_SPEND_LIMITS?: string;
  /** "keys" or "credits": how setup set up paying for vendor models. */
  AI_BILLING?: string;
  /** Web Push (VAPID) keys, written by setup.mjs or `bun run push:keys`; push is off without them. */
  VAPID_PUBLIC_KEY?: string;
  /** Secret. */
  VAPID_PRIVATE_KEY?: string;
  /** A mailto: or https: URL push services can contact; setup uses the deployment's URL. */
  VAPID_SUBJECT?: string;
  /** "on" stores message and tool payloads on traces; they can contain personal data. */
  TRACE_PAYLOADS?: string;
  /** "on" enables the webSearch tool. */
  WEB_SEARCH?: string;
  /** AI Gateway id that routes and bills searches; defaults to "default". */
  WEB_SEARCH_GATEWAY?: string;
  /** Search provider, e.g. "exa"; defaults to the platform default. */
  WEB_SEARCH_PROVIDER?: string;
}

interface Env extends OptionalBindings {}

declare namespace Cloudflare {
  interface Env extends OptionalBindings {}
}
