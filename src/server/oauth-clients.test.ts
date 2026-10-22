import { describe, expect, test } from "bun:test";
import {
  convertGitHubManifest,
  GITHUB_APP_PERMISSIONS,
  githubAppManifest,
  githubManifestTarget,
  PreregisteredOAuthProvider,
} from "./oauth-clients";

function memoryStorage() {
  const map = new Map<string, unknown>();
  return {
    delete: async (key: string) => map.delete(key),
    get: async (key: string) => map.get(key),
    map,
    put: async (key: string, value: unknown) => void map.set(key, value),
  } as unknown as DurableObjectStorage & { map: Map<string, unknown> };
}

describe("githubManifestTarget", () => {
  test("a personal account or a named organization", () => {
    expect(githubManifestTarget(null, "s1")).toBe("https://github.com/settings/apps/new?state=s1");
    expect(githubManifestTarget("acme", "s1")).toBe("https://github.com/organizations/acme/settings/apps/new?state=s1");
  });
});

describe("githubAppManifest", () => {
  const manifest = githubAppManifest({
    callbackUrl: "https://ph.example.com/agents/org/team/callback",
    orgName: "Acme <Corp>",
    origin: "https://ph.example.com",
    suffix: "ab12",
  });

  test("is private, has no live webhook and only the permissions jobs need", () => {
    expect(manifest.public).toBe(false);
    expect(manifest.hook_attributes.active).toBe(false);
    expect(manifest.default_permissions).toEqual(GITHUB_APP_PERMISSIONS);
  });

  test("returns to the deployment and signs in through its OAuth callback", () => {
    expect(manifest.redirect_url).toBe("https://ph.example.com/api/github-app/created");
    expect(manifest.callback_urls).toEqual(["https://ph.example.com/agents/org/team/callback"]);
  });

  test("a name within GitHub's 34 characters, without markup", () => {
    expect(manifest.name).toBe("powerhouse Acme Corp ab12");
    expect(manifest.name.length).toBeLessThanOrEqual(34);
  });
});

describe("convertGitHubManifest", () => {
  test("keeps the client id and secret, not the private key or webhook secret", async () => {
    let called = "";
    const app = await convertGitHubManifest("abc123", (async (url: string) => {
      called = url;
      return Response.json(
        { client_id: "Iv1.x", client_secret: "s3cret", owner: { login: "acme" }, pem: "KEY", slug: "powerhouse-acme", webhook_secret: "w" },
        { status: 201 },
      );
    }) as unknown as typeof fetch);
    expect(called).toBe("https://api.github.com/app-manifests/abc123/conversions");
    expect(app).toEqual({ clientId: "Iv1.x", clientSecret: "s3cret", owner: "acme", slug: "powerhouse-acme" });
  });

  test("refuses a malformed code without calling GitHub", async () => {
    await expect(convertGitHubManifest("../x", (() => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch)).rejects.toThrow("invalid code");
  });

  test("an expired code reads as such", async () => {
    await expect(convertGitHubManifest("old", (async () => new Response("", { status: 404 })) as unknown as typeof fetch)).rejects.toThrow(
      "lasts an hour",
    );
  });
});

describe("PreregisteredOAuthProvider", () => {
  const lookup = (serverId: string) => (serverId === "c-github" ? { clientId: "Iv1.x", clientSecret: "s3cret" } : null);

  test("a server with its own app gets that app's credentials, and nothing is stored", async () => {
    const storage = memoryStorage();
    const provider = new PreregisteredOAuthProvider(storage, "team", "https://ph.example.com/cb", lookup);
    provider.serverId = "c-github";
    expect(await provider.clientInformation()).toEqual({ client_id: "Iv1.x", client_secret: "s3cret" });
    await provider.saveClientInformation({ client_id: "registered" } as never);
    expect(storage.map.size).toBe(0);
    expect(provider.clientId).toBe("Iv1.x");
  });

  test("other servers register and store their client as before", async () => {
    const storage = memoryStorage();
    const provider = new PreregisteredOAuthProvider(storage, "team", "https://ph.example.com/cb", lookup);
    provider.serverId = "c-linear";
    expect(await provider.clientInformation()).toBeUndefined();
    await provider.saveClientInformation({ client_id: "dyn-1" } as never);
    expect(await provider.clientInformation()).toEqual({ client_id: "dyn-1" });
  });
});
