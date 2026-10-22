import { DurableObject } from "cloudflare:workers";

/** The Access application a deployment verifies sign-ins against (see auth.ts). */
export interface AccessSettings {
  /** https://<team>.cloudflareaccess.com */
  teamDomain: string;
  /** The Access application's AUD tag. */
  aud: string;
}

/**
 * What a deployment set up in the browser (Finish setup) keeps for itself.
 * A deployment made with setup.mjs has these as vars in wrangler.local.jsonc;
 * one deployed from GitHub with the Deploy to Cloudflare button rebuilds from
 * the repository on every push, which cannot hold them, so they live here.
 * One instance per deployment, named "main".
 */
export class Deployment extends DurableObject<Env> {
  async access(): Promise<AccessSettings | null> {
    return (await this.ctx.storage.get<AccessSettings>("access")) ?? null;
  }

  async saveAccess(settings: AccessSettings) {
    await this.ctx.storage.put("access", settings);
  }
}

export function deployment(env: Env) {
  return env.DEPLOYMENT.get(env.DEPLOYMENT.idFromName("main"));
}
