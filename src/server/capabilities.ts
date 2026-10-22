import type { Capabilities, ModelProvider } from "../shared";

/**
 * Optional tools are on only when their bindings are configured (see
 * wrangler.local.example.jsonc), so a deployment never bills for, or offers,
 * a feature its operator has not set up.
 */
export function capabilitiesFor(env: Env): Capabilities {
  return {
    browser: Boolean(env.BROWSER && env.LOADER),
    sendEmail: Boolean(env.EMAIL && env.EMAIL_FROM),
    webFetch: true,
    webSearch: env.WEB_SEARCH === "on",
  };
}

/** Web Push keys for this deployment, or null when push is not set up. */
export function vapidFor(env: Env) {
  return env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
    ? { privateKey: env.VAPID_PRIVATE_KEY, publicKey: env.VAPID_PUBLIC_KEY, subject: env.VAPID_SUBJECT }
    : null;
}

const VENDORS: readonly ModelProvider[] = ["anthropic", "openai"];

/** Vendors reachable through the deployment's AI Gateway; none without a gateway. */
export function providersFor(env: Env): ModelProvider[] {
  if (!env.AI_GATEWAY_ID) {
    return [];
  }
  const listed = (env.AI_PROVIDERS ?? "").split(",").map((p) => p.trim());
  return VENDORS.filter((vendor) => listed.includes(vendor));
}
