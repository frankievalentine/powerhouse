import { DurableObject } from "cloudflare:workers";

/** The Access application a deployment verifies sign-ins against (see auth.ts). */
export interface AccessSettings {
  /** https://<team>.cloudflareaccess.com */
  teamDomain: string;
  /** The Access application's AUD tag. */
  aud: string;
}

/**
 * What Finish setup saves: the same settings setup.mjs writes as vars in
 * wrangler.local.jsonc (and the push keys it stores as Worker secrets).
 */
export interface DeploymentConfig {
  access: AccessSettings;
  /** Comma-separated, like ADMIN_EMAILS. */
  adminEmails: string;
  aiGatewayId?: string;
  /** Comma-separated, like AI_PROVIDERS. */
  aiProviders?: string;
  aiBilling?: "keys" | "credits";
  vapid: { publicKey: string; privateKey: string; subject: string };
  /** Web search on (it bills through the AI Gateway); changed later in Settings. */
  webSearch?: boolean;
  /** Entered in Finish setup; the org's Website setting starts from it. */
  website?: string;
  completedAt: number;
}

/**
 * What a deployment set up in the browser (Finish setup) keeps for itself.
 * A deployment made with setup.mjs has these as vars in wrangler.local.jsonc;
 * one deployed with the Deploy to Cloudflare button rebuilds from its
 * repository on every push, which cannot hold them, so they live here.
 * One instance per deployment, named "main".
 */
export class Deployment extends DurableObject<Env> {
  async config(): Promise<DeploymentConfig | null> {
    return (await this.ctx.storage.get<DeploymentConfig>("config")) ?? null;
  }

  async access(): Promise<AccessSettings | null> {
    return (await this.config())?.access ?? null;
  }

  async save(config: DeploymentConfig) {
    await this.ctx.storage.put("config", config);
  }

  /** Settings > Tools: web search on or off. Returns the updated config. */
  async setWebSearch(on: boolean): Promise<DeploymentConfig | null> {
    const config = await this.config();
    if (!config) {
      return null;
    }
    const next = { ...config, webSearch: on };
    await this.ctx.storage.put("config", next);
    return next;
  }
}

export function deployment(env: Env) {
  return env.DEPLOYMENT.get(env.DEPLOYMENT.idFromName("main"));
}

/**
 * The Worker's env with Finish setup's settings filled in where
 * wrangler.local.jsonc has none, so code reading env.ADMIN_EMAILS,
 * env.AI_GATEWAY_ID or env.VAPID_* works the same for both kinds of
 * deployment. Vars always win. Org and JobAgent apply it when they start.
 */
export async function withDeploymentConfig(env: Env): Promise<Env> {
  return applyDeploymentConfig(env, await deployment(env).config());
}

export function applyDeploymentConfig(env: Env, config: DeploymentConfig | null): Env {
  if (!config) {
    return env;
  }
  const saved: Partial<Record<keyof Env, string | undefined>> = {
    ACCESS_AUD: config.access.aud,
    ACCESS_TEAM_DOMAIN: config.access.teamDomain,
    ADMIN_EMAILS: config.adminEmails,
    AI_BILLING: config.aiBilling,
    AI_GATEWAY_ID: config.aiGatewayId,
    AI_PROVIDERS: config.aiProviders,
    VAPID_PRIVATE_KEY: config.vapid.privateKey,
    VAPID_PUBLIC_KEY: config.vapid.publicKey,
    VAPID_SUBJECT: config.vapid.subject,
    WEB_SEARCH: config.webSearch ? "on" : undefined,
  };
  const merged: Record<string, unknown> = { ...env };
  for (const [key, value] of Object.entries(saved)) {
    if (value !== undefined && !merged[key]) {
      merged[key] = value;
    }
  }
  return merged as unknown as Env;
}
