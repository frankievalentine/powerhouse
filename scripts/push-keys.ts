// Adds Web Push (VAPID) keys to .dev.vars for local development, so push
// notifications work under `bun run dev`. Deployments get their own keys
// from setup.mjs. Existing keys are kept: new ones would break every
// browser's subscription.
//
//   bun run push:keys

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const file = join(resolve(import.meta.dirname, ".."), ".dev.vars");
const current = existsSync(file) ? readFileSync(file, "utf8") : "";

if (/^VAPID_PRIVATE_KEY=/m.test(current)) {
  console.log(".dev.vars already has push keys.");
} else {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicKey = Buffer.from(await crypto.subtle.exportKey("raw", pair.publicKey)).toString("base64url");
  const lines = [
    "# Web Push keys for local development (bun run push:keys).",
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${jwk.d}`,
    "VAPID_SUBJECT=mailto:dev@localhost",
  ];
  writeFileSync(file, `${current}${current && !current.endsWith("\n") ? "\n" : ""}${lines.join("\n")}\n`);
  console.log("Added push keys to .dev.vars. Restart bun run dev to use them.");
}
