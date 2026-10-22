import { DurableObjectOAuthClientProvider } from "agents/mcp/do-oauth-client-provider";

type ClientInformation = Parameters<DurableObjectOAuthClientProvider["saveClientInformation"]>[0];

/** An OAuth app registered by hand or created from a GitHub App manifest, for a server without dynamic registration. */
export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

/**
 * The SDK's provider, except that a server with an OAuth app of its own
 * gets that app's client id and secret instead of registering one: the MCP
 * client only registers when the provider has no client information. The
 * secret is read from Org's table on each use and never copied into the
 * provider's storage.
 */
export class PreregisteredOAuthProvider extends DurableObjectOAuthClientProvider {
  readonly #lookup: (serverId: string) => OAuthClient | null;

  constructor(storage: DurableObjectStorage, clientName: string, callbackUrl: string, lookup: (serverId: string) => OAuthClient | null) {
    super(storage, clientName, callbackUrl);
    this.#lookup = lookup;
  }

  /** The server's own app, once the SDK has told the provider which server it serves. */
  #client(): OAuthClient | null {
    let serverId: string;
    try {
      serverId = this.serverId;
    } catch {
      return null;
    }
    const client = this.#lookup(serverId);
    if (client) {
      this.clientId = client.clientId;
    }
    return client;
  }

  async clientInformation(context?: Parameters<DurableObjectOAuthClientProvider["clientInformation"]>[0]) {
    const client = this.#client();
    if (!client) {
      return super.clientInformation(context);
    }
    return { client_id: client.clientId, client_secret: client.clientSecret } as ClientInformation;
  }

  async saveClientInformation(info: ClientInformation, context?: Parameters<DurableObjectOAuthClientProvider["saveClientInformation"]>[1]) {
    if (this.#client()) {
      return;
    }
    return super.saveClientInformation(info, context);
  }

  async tokens(context?: Parameters<DurableObjectOAuthClientProvider["tokens"]>[0]) {
    // Tokens are stored under the client id, which a restored connection may not have set yet.
    this.#client();
    return super.tokens(context);
  }
}

/** GitHub's remote MCP server; it signs in through github.com/login/oauth, which has no dynamic registration. */
export const GITHUB_MCP_URL = "https://api.githubcopilot.com/mcp/";

/** What jobs may do through the GitHub App, before each write's own approval. */
export const GITHUB_APP_PERMISSIONS = { contents: "write", issues: "write", metadata: "read", pull_requests: "write" } as const;

/** GitHub's form target for creating an app from a manifest, for a personal account or an organization. */
export function githubManifestTarget(owner: string | null, state: string) {
  const base = owner
    ? `https://github.com/organizations/${encodeURIComponent(owner)}/settings/apps/new`
    : "https://github.com/settings/apps/new";
  return `${base}?state=${encodeURIComponent(state)}`;
}

/**
 * The app GitHub creates from the manifest flow: private (only its owner can
 * install it), no webhooks, our OAuth callback, and only the permissions jobs
 * need. GitHub app names are unique across GitHub, so the name gets a suffix;
 * the admin can change it on GitHub's page.
 */
export function githubAppManifest(options: { origin: string; callbackUrl: string; orgName: string; suffix: string }) {
  const label = options.orgName.replace(/[^A-Za-z0-9 -]/g, "").trim().slice(0, 16) || "team";
  return {
    callback_urls: [options.callbackUrl],
    default_permissions: GITHUB_APP_PERMISSIONS,
    description: "Lets powerhouse jobs read your repositories and, after your approval, open branches, pull requests and issues.",
    hook_attributes: { active: false, url: `${options.origin}/api/github-app/webhook` },
    name: `powerhouse ${label} ${options.suffix}`.slice(0, 34),
    public: false,
    redirect_url: `${options.origin}/api/github-app/created`,
    request_oauth_on_install: false,
    url: options.origin,
  };
}

/** What powerhouse keeps from GitHub's answer; the private key and webhook secret are dropped. */
export interface CreatedGitHubApp extends OAuthClient {
  slug: string;
  owner: string;
}

/** Trades the manifest flow's one-time code (valid for an hour) for the new app's credentials. */
export async function convertGitHubManifest(code: string, fetcher: typeof fetch = fetch): Promise<CreatedGitHubApp> {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(code)) {
    throw new Error("GitHub sent back an invalid code. Start again from Settings > Connections.");
  }
  const response = await fetcher(`https://api.github.com/app-manifests/${code}/conversions`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "powerhouse", "x-github-api-version": "2022-11-28" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      response.status === 404 || response.status === 422
        ? "GitHub no longer accepts this code (it lasts an hour and works once). Start again from Settings > Connections."
        : `GitHub could not finish creating the app (${response.status}). Try again from Settings > Connections.`,
    );
  }
  const app = (await response.json()) as { client_id?: string; client_secret?: string; slug?: string; owner?: { login?: string } };
  if (!(app.client_id && app.client_secret && app.slug)) {
    throw new Error("GitHub's answer was missing the app's credentials. Try again from Settings > Connections.");
  }
  return { clientId: app.client_id, clientSecret: app.client_secret, owner: app.owner?.login ?? "", slug: app.slug };
}
