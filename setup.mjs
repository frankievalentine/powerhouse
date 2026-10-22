#!/usr/bin/env node
// powerhouse setup: signs in to Cloudflare, protects powerhouse with Cloudflare
// Access, writes wrangler.local.jsonc and deploys. Plain ESM
// with no dependencies, so it runs before anything is installed. Safe to rerun:
// every step checks what already exists before changing anything.
//
//   node setup.mjs                      interactive
//   node setup.mjs --yes --json ...     for agents; see --help

import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const MIN_NODE_MAJOR = 20;
const ROOT = dirname(fileURLToPath(import.meta.url));
const LOCAL_CONFIG = join(ROOT, "wrangler.local.jsonc");
const WRANGLER = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const API = "https://api.cloudflare.com/client/v4";
const POLICY_NAME = "powerhouse members";
const IS_WINDOWS = process.platform === "win32";

const HELP = `Usage: node setup.mjs [options]

Options:
  --allow <list>     Who may sign in: comma-separated emails and/or @domains,
                     e.g. "you@example.com,@example.com". Defaults to the
                     email you signed in to Cloudflare with.
  --account <id>     Cloudflare account id, when you have more than one.
  --update           Update to the latest powerhouse release first, then set
                     up and deploy as usual. Your settings are kept.
  --remove           Remove this powerhouse from Cloudflare: its Access
                     application, its Worker with all its data (roles, jobs,
                     settings) and its AI Gateway. Lists everything first and
                     asks you to type the Worker's name; --yes skips that.
                     Shared things (Zero Trust, login methods, your domains)
                     are never touched.
  --admins <list>    Who are always powerhouse admins (comma-separated
                     emails); admins change settings, roles and connections.
                     Defaults to the email you signed in to Cloudflare with.
                     More admins can be added in Settings > Members.
<<<<<<< HEAD
  --token <token>    API token for creating the Access application. Prefer
                     POWERHOUSE_SETUP_TOKEN: a flag ends up in shell history.
                     Only needed the first time.
=======
  --token <token>    API token for creating the Access application and the AI
                     Gateway. Also read from POWERHOUSE_SETUP_TOKEN. Only needed
                     the first time.
  --ai-billing <b>   How Claude and GPT are paid for. "dashboard"
                     (recommended): you add your Anthropic and/or OpenAI key
                     to the AI Gateway in the Cloudflare dashboard; setup
                     never sees it. "keys": setup stores keys read from
                     POWERHOUSE_ANTHROPIC_KEY / POWERHOUSE_OPENAI_KEY on the
                     gateway. "credits": Cloudflare Unified Billing. Asked on
                     the first run; pass it again to change.
  --ai-providers <l> With --ai-billing dashboard, which keys you added
                     (anthropic, openai), when setup cannot list them.
  --ai-logs          Keep AI Gateway logs of prompts and results (off by
                     default: they can contain personal data).
>>>>>>> 4704842 (feat: AI Gateway setup step, model health and Test in Settings)
  --features         Choose which optional tools to turn on (web search,
                     browser, email). Asked automatically on the first run.
  --enable <list>    Turn tools on without prompting: web-search, browser,
                     email (comma-separated).
  --disable <list>   Turn tools off without prompting, same names.
  --email-from <a>   Sender address for email, on a domain added to
                     Cloudflare Email Service.
  --skip-deploy      Configure everything but do not deploy.
  --yes              Never prompt; fail with instructions instead.
  --json             Print one JSON result on stdout (progress goes to stderr).
  --help             Show this help.
`;

class SetupError extends Error {
  /** @param {string} step @param {string} message @param {string} next what the operator should do */
  constructor(step, message, next) {
    super(message);
    this.step = step;
    this.next = next;
  }
}

const args = parseArgs(process.argv.slice(2));
const steps = [];

/** main's result when an updated setup.mjs ran instead and already reported. */
const HANDED_OFF = Symbol("handed off");

main().finally(closePrompts).then(
  (result) => {
    if (result === HANDED_OFF) {
      return;
    }
    if (args.json) {
      process.stdout.write(`${JSON.stringify({ ok: true, ...result, steps })}\n`);
    }
  },
  (error) => {
    const known = error instanceof SetupError;
    const failure = {
      error: error.message,
      next: known ? error.next : "This is unexpected. Rerun setup; if it fails again, open an issue with this output.",
      ok: false,
      step: known ? error.step : "unknown",
    };
    if (args.json) {
      process.stdout.write(`${JSON.stringify({ ...failure, steps })}\n`);
    } else {
      log(`\nSetup stopped at "${failure.step}": ${failure.error}\nNext: ${failure.next}`);
      if (!known) {
        console.error(error);
      }
    }
    process.exitCode = 1;
  },
);

async function main() {
  if (args.help) {
    process.stdout.write(HELP);
    return {};
  }
  checkNode();
  if (args.remove) {
    installDependencies();
    return removePowerhouse(await signIn());
  }
  if (args.update && updateCheckout()) {
    // The release can change setup itself, so its own setup.mjs finishes the job.
    const rest = process.argv.slice(2).filter((arg) => arg !== "--update");
    const child = spawnSync(process.execPath, [join(ROOT, "setup.mjs"), ...rest], { cwd: ROOT, stdio: "inherit" });
    process.exitCode = child.status ?? 1;
    return HANDED_OFF;
  }
  installDependencies();
  const account = await signIn();
  const admins = chooseAdmins(account);
  const worker = workerName();
  // Tool choices are saved before the token step, so a run that stops there
  // for a token keeps them for the rerun.
  const features = await chooseFeatures({ firstRun: !readLocalVars().ACCESS_AUD });
  // Asked before the token, whose permissions depend on the answer.
  const aiMethod = aiGatewayNeedsToken(readLocalVars()) ? await aiBilling(readLocalVars()) : null;
  const token = await setupToken(account, aiMethod);

  let teamDomain;
  let url = null;
  if (token) {
    const cf = cloudflare(token, account.id);
    const subdomain = await workersSubdomain(cf);
    const hostname = `${worker}.${subdomain}.workers.dev`;
    teamDomain = await zeroTrustTeam(cf);
    const idps = await loginMethods(cf);
    const aud = await accessApplication(cf, { account, hostname, idps });
    writeLocalConfig({ ACCESS_AUD: aud, ACCESS_TEAM_DOMAIN: `https://${teamDomain}` });
    url = `https://${hostname}`;
  } else {
    teamDomain = new URL(readLocalVars().ACCESS_TEAM_DOMAIN).hostname;
  }
  const ai = await aiGateway(token ? cloudflare(token, account.id) : null, worker, aiMethod, account);

  if (args.skipDeploy) {
    done("deploy", "skipped (--skip-deploy)");
    return { admins, ai, deployed: false, features, teamDomain, url };
  }
  warnPaidFeatures();
  const pushKey = preparePushKeys(worker);
  url = deploy() ?? url;
  if (!url) {
    throw new SetupError(
      "deploy",
      "Deployed, but the deploy output did not include a workers.dev address.",
      "Find powerhouse under Workers & Pages in the Cloudflare dashboard; its address is on the Worker's overview.",
    );
  }
  storePushSecrets(worker, pushKey, url);
  await verifyProtected(url, teamDomain);
  log(`\npowerhouse is running at ${url}\nSign in with an address you allowed. Your org is created on first sign-in.`);
  if (!args.yes) {
    openUrl(url);
  }
  if (ai.billing === "credits") {
    log("Claude and GPT are billed to AI Gateway credits: buy them in the Cloudflare dashboard under AI > AI Gateway > Credits.");
  }
  log("Check the AI models in powerhouse under Settings > Models > Test.");
  if (token) {
    log('Setup is done with the API token. Delete "powerhouse setup" at https://dash.cloudflare.com/profile/api-tokens; a rerun asks for a new one if it needs one.');
  }
  return { admins, ai, deleteSetupToken: Boolean(token), deployed: true, features, teamDomain, url };
}

// Steps

function checkNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < MIN_NODE_MAJOR) {
    throw new SetupError(
      "node",
      `Node ${process.versions.node} is too old.`,
      `Install the current Node LTS from https://nodejs.org (version ${MIN_NODE_MAJOR} or later), then rerun setup.`,
    );
  }
  done("node", `Node ${process.versions.node}`);
}

/**
 * --update: moves this clone to the latest powerhouse release (a v* tag on
 * GitHub). Settings in wrangler.local.jsonc and .dev.vars are not tracked by
 * git, so they stay. Returns whether anything changed.
 */
function updateCheckout() {
  const git = (...gitArgs) => spawnSync("git", gitArgs, { cwd: ROOT, encoding: "utf8" });
  if (git("rev-parse", "--is-inside-work-tree").status !== 0) {
    throw new SetupError(
      "update",
      "This folder is not a git clone of powerhouse, so it cannot update itself.",
      "Clone it with git clone https://github.com/frankievalentine/powerhouse.git, copy your wrangler.local.jsonc into the new folder, and run setup there.",
    );
  }
  if (git("fetch", "--tags", "--quiet", "origin").status !== 0) {
    throw new SetupError("update", "Could not reach GitHub to check for a new release.", "Check your internet connection and rerun.");
  }
  const [latest] = git("tag", "--list", "v*", "--sort=-v:refname").stdout.split("\n").filter(Boolean);
  if (!latest) {
    done("update", "no releases yet");
    return false;
  }
  if (git("merge-base", "--is-ancestor", latest, "HEAD").status === 0) {
    done("update", `already up to date (${latest} or newer)`);
    return false;
  }
  if (git("status", "--porcelain", "--untracked-files=no").stdout.trim()) {
    throw new SetupError(
      "update",
      "Files git tracks in this folder have changed, so it cannot update cleanly.",
      "Run git status to see them, then commit or set them aside (git stash) and rerun with --update.",
    );
  }
  if (git("merge", "--ff-only", "--quiet", latest).status !== 0) {
    throw new SetupError(
      "update",
      `This copy has commits of its own, so it cannot move to ${latest} by itself.`,
      `Merge it yourself (git merge ${latest}), then rerun setup without --update.`,
    );
  }
  done("update", `updated to ${latest}`);
  return true;
}

/** Uses the Bun version pinned in package.json through npx, so operators never install Bun. */
function installDependencies() {
  const { packageManager } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  log(`Installing dependencies with ${packageManager} (first run downloads it)...`);
  const result = run("npx", ["--yes", packageManager, "install", "--frozen-lockfile"], { cwd: ROOT });
  if (result.status !== 0) {
    throw new SetupError(
      "install",
      "Installing dependencies failed (see the output above).",
      "Check your internet connection and rerun setup. If you changed files in this folder, `git status` shows what.",
    );
  }
  done("install", packageManager);
}

async function signIn() {
  let who = whoami();
  if (!who.loggedIn) {
    if (args.yes) {
      log("Opening the browser to sign in to Cloudflare...");
    }
    const login = run("node", [WRANGLER, "login"], { cwd: ROOT });
    who = whoami();
    if (login.status !== 0 || !who.loggedIn) {
      throw new SetupError(
        "sign-in",
        "Signing in to Cloudflare did not complete.",
        "Rerun setup and approve the sign-in page that opens in your browser.",
      );
    }
  }
  const accounts = who.accounts ?? [];
  let account = args.account ? accounts.find((a) => a.id === args.account) : accounts.length === 1 ? accounts[0] : null;
  if (!account && accounts.length > 1 && !args.account && !args.yes) {
    log("\nYour Cloudflare accounts:");
    accounts.forEach((a, i) => log(`  ${i + 1}. ${a.name} (${a.id})`));
    const pick = Number(await ask("Which account should powerhouse run in? Number: "));
    account = accounts[pick - 1] ?? null;
  }
  if (!account) {
    throw new SetupError(
      "sign-in",
      args.account ? `Account ${args.account} is not one you can use.` : "Choose which Cloudflare account to use.",
      `Rerun with --account and one of: ${accounts.map((a) => `${a.id} (${a.name})`).join(", ")}`,
    );
  }
  done("sign-in", `account ${account.name}${who.email ? `, signed in as ${who.email}` : ""}`);
  return { email: who.email ?? null, id: account.id, name: account.name };
}

/** The Worker name, from the overlay if it sets one. Custom domains are not handled by setup yet. */
function workerName() {
  const local = existsSync(LOCAL_CONFIG) ? stripJsoncComments(readFileSync(LOCAL_CONFIG, "utf8")) : "";
  if (/"routes"\s*:|"workers_dev"\s*:\s*false/.test(local)) {
    throw new SetupError(
      "config",
      "Your wrangler.local.jsonc serves powerhouse on custom routes, which setup does not configure yet.",
      "Follow the Deploy section of README.md for custom domains, or remove the routes to use workers.dev.",
    );
  }
  const base = stripJsoncComments(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"));
  const name = (local.match(/^\s*"name"\s*:\s*"([^"]+)"/m) ?? base.match(/^\s*"name"\s*:\s*"([^"]+)"/m))?.[1];
  return name ?? "powerhouse";
}

/**
 * Wrangler's sign-in does not cover Cloudflare Access, so setup asks for an API
 * token once, through a pre-filled token page. It is used for this run only and
 * never written to disk. Reruns that find the Access application already
 * configured skip it.
 */
async function setupToken(account, aiMethod) {
  const configured = readLocalVars();
  const provided = args.token ?? process.env.POWERHOUSE_SETUP_TOKEN;
  if (!provided && configured.ACCESS_AUD && configured.ACCESS_TEAM_DOMAIN && !args.allow && !aiMethod) {
    done("access-token", "not needed: Access and the AI Gateway are already configured");
    return null;
  }
  const permissions = [
    { key: "access", type: "edit" },
    { key: "access_acct", type: "edit" },
    { key: "workers_scripts", type: "read" },
    // AI Gateway: Edit. The key is undocumented; "aig" was confirmed in the
    // dashboard on 2026-10-21 (the page silently ignores unknown keys).
    ...(aiMethod ? [{ key: "aig", type: "edit" }] : []),
  ];
  // Secrets Store's key is unknown, so when setup stores provider keys that
  // permission is added by hand. Both are checked once the token is pasted.
  const manual = aiMethod === "keys" ? "Account > Secrets Store > Edit" : null;
  const templateUrl = tokenUrl(account, permissions, "powerhouse setup");
  let token = provided;
  if (!token) {
    if (args.yes) {
      throw new SetupError(
        "access-token",
        "Setup needs a one-time API token to create the Cloudflare Access application and the AI Gateway.",
        `Open ${templateUrl}${manual ? `, choose "+ Add more" and add ${manual} (the link cannot pre-fill it)` : ""}, click "Continue to summary" and "Create token", copy the token, then rerun with the token in the POWERHOUSE_SETUP_TOKEN environment variable (not on the command line).`,
      );
    }
    log(
      "\nSetup needs a one-time API token to protect powerhouse with Cloudflare Access and set up its AI Gateway." +
        "\nYour browser will open the token page with the right permissions filled in." +
        (manual ? `\nChoose "+ Add more" and add ${manual}: the link cannot pre-fill that one.` : "") +
        '\nClick "Continue to summary", then "Create token", and paste the token here.' +
        "\nIt is used for this setup only and is not saved.\n",
    );
    openUrl(templateUrl);
    token = await askHidden("API token: ");
  }
  const verify = await fetch(`${API}/user/tokens/verify`, { headers: { authorization: `Bearer ${token}` } })
    .then((r) => r.json())
    .catch(() => null);
  if (!verify?.success || verify.result?.status !== "active") {
    throw new SetupError(
      "access-token",
      "Cloudflare did not accept that API token.",
      `Create a new one at ${templateUrl} and paste the whole token.`,
    );
  }
  if (aiMethod) {
    // Fail now, not halfway through: the AI Gateway permission is added by hand.
    await cloudflare(token, account.id)
      .get("/ai-gateway/gateways", "access-token")
      .catch((error) => {
        if (error instanceof SetupError && (error.status === 403 || error.status === 401)) {
          throw new SetupError(
            "access-token",
            "The API token cannot manage AI Gateway.",
            "Edit the token in the Cloudflare dashboard (My Profile > API Tokens) and add Account > AI Gateway > Edit, then rerun and paste the same token.",
          );
        }
        throw error;
      });
  }
  done("access-token", "verified");
  return token;
}

/** The Cloudflare token page with these permissions filled in. */
function tokenUrl(account, permissions, name) {
  return (
    "https://dash.cloudflare.com/profile/api-tokens" +
    `?permissionGroupKeys=${encodeURIComponent(JSON.stringify(permissions))}` +
    `&accountId=${encodeURIComponent(account.id)}&zoneId=all&name=${encodeURIComponent(name)}`
  );
}

async function workersSubdomain(cf) {
  const result = await cf.get("/workers/subdomain", "workers-subdomain").catch((error) => {
    if (error instanceof SetupError && error.status === 404) {
      throw new SetupError(
        "workers-subdomain",
        "Your account has no workers.dev subdomain yet.",
        "Open Workers & Pages in the Cloudflare dashboard once, choose a subdomain, then rerun setup.",
      );
    }
    throw error;
  });
  done("workers-subdomain", `${result.subdomain}.workers.dev`);
  return result.subdomain;
}

async function zeroTrustTeam(cf) {
  const org = await cf.get("/access/organizations", "zero-trust").catch((error) => {
    if (error instanceof SetupError && (error.status === 404 || error.status === 400)) {
      throw new SetupError(
        "zero-trust",
        "Cloudflare Zero Trust is not set up on this account.",
        "Open https://one.dash.cloudflare.com, choose a team name and the Free plan (it asks for a payment method even on Free), then rerun setup.",
      );
    }
    throw error;
  });
  done("zero-trust", `team ${org.auth_domain}`);
  return org.auth_domain;
}

/** Without any login method nobody can sign in; One-time PIN needs no identity provider. */
async function loginMethods(cf) {
  const idps = await cf.get("/access/identity_providers", "login-methods");
  if (idps.length > 0) {
    done("login-methods", idps.map((i) => i.name || i.type).join(", "));
    return idps;
  }
  const pin = await cf.post(
    "/access/identity_providers",
    { config: {}, name: "One-time PIN", type: "onetimepin" },
    "login-methods",
  );
  done("login-methods", "added One-time PIN (sign-in codes by email)");
  return [pin];
}

/**
 * Reuses an Access application already protecting the hostname, leaving its
 * policies alone unless --allow is given. Otherwise creates the "powerhouse
 * members" policy and an application for the hostname. Returns its AUD tag.
 */
async function accessApplication(cf, { account, hostname, idps }) {
  const apps = await cf.get("/access/apps", "access-app");
  const existing = apps.find((a) => a.domain === hostname || a.self_hosted_domains?.includes(hostname));
  if (existing && !args.allow) {
    done("access-app", `kept existing application "${existing.name}"`);
    return existing.aud;
  }
  const allow = await allowList(account);
  const policyId = await membersPolicy(cf, allow);
  const body = {
    auto_redirect_to_identity: idps.length === 1,
    domain: hostname,
    name: existing?.name ?? "powerhouse",
    policies: [{ id: policyId, precedence: 1 }],
    session_duration: existing?.session_duration ?? "24h",
    type: "self_hosted",
  };
  const app = existing
    ? await cf.put(`/access/apps/${existing.id}`, body, "access-app")
    : await cf.post("/access/apps", body, "access-app");
  done("access-app", `${existing ? "updated" : "created"} application for ${hostname}`);
  return app.aud;
}

async function allowList(account) {
  let raw = args.allow;
  if (!raw && !args.yes) {
    const suggestion = account.email ? ` [${account.email}]` : "";
    raw = (await ask(`Who may sign in? Emails and/or @domains, comma-separated${suggestion}: `)) || account.email;
  }
  raw ??= account.email;
  const entries = (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const invalid = entries.filter((e) => !/^[^@\s]*@[^@\s]+\.[^@\s]+$/.test(e));
  if (entries.length === 0 || invalid.length > 0) {
    throw new SetupError(
      "allow",
      invalid.length > 0 ? `Not an email or @domain: ${invalid.join(", ")}` : "No one would be allowed to sign in.",
      'Rerun with --allow "you@example.com" or --allow "@example.com".',
    );
  }
  return entries;
}

async function membersPolicy(cf, allow) {
  const include = allow.map((entry) =>
    entry.startsWith("@") ? { email_domain: { domain: entry.slice(1) } } : { email: { email: entry } },
  );
  const body = { decision: "allow", include, name: POLICY_NAME };
  const policies = await cf.get("/access/policies", "access-policy");
  const existing = policies.find((p) => p.name === POLICY_NAME);
  const policy = existing
    ? await cf.put(`/access/policies/${existing.id}`, body, "access-policy")
    : await cf.post("/access/policies", body, "access-policy");
  done("access-policy", `${existing ? "updated" : "created"} "${POLICY_NAME}": ${allow.join(", ")}`);
  return policy.id;
}

/**
 * Optional tools, each switched by a block of wrangler.local.jsonc. A tool is
 * on when all its config is present; the app reads the same bindings.
 */
const FEATURES = {
  browser: {
    label: "Web browser",
    note: "Needs the Workers Paid plan. Billed by Browser Run time and Dynamic Workers usage.",
    isOn: (config) => config.has("browser") && config.has("worker_loaders"),
    turnOn: (config) => {
      config.set("browser", { binding: "BROWSER", remote: true });
      config.set("worker_loaders", [{ binding: "LOADER" }]);
    },
    turnOff: (config) => {
      config.remove("browser");
      config.remove("worker_loaders");
    },
  },
  email: {
    label: "Send email",
    note: "Needs a domain you own added to Cloudflare Email Service. Every email waits for approval.",
    isOn: (config) => config.has("send_email") && Boolean(config.vars().EMAIL_FROM),
    turnOn: (config, { emailFrom }) => {
      config.set("send_email", [{ name: "EMAIL" }]);
      config.setVars({ EMAIL_FROM: emailFrom });
    },
    turnOff: (config) => config.remove("send_email"),
  },
  "web-search": {
    label: "Search the web",
    note: "Billed per search through AI Gateway: add AI Gateway credits or a search provider key on the gateway.",
    isOn: (config) => config.vars().WEB_SEARCH === "on",
    turnOn: (config) => config.setVars({ WEB_SEARCH: "on" }),
    turnOff: (config) => config.setVars({ WEB_SEARCH: "off" }),
  },
};

/**
 * Turns optional tools on or off from --enable/--disable, or by asking with
 * --features and on the first run. Returns which tools are on afterward.
 */
async function chooseFeatures({ firstRun }) {
  const config = localConfig();
  const wanted = new Map();
  for (const id of args.enable) wanted.set(id, true);
  for (const id of args.disable) wanted.set(id, false);
  const unknown = [...wanted.keys()].filter((id) => !(id in FEATURES));
  if (unknown.length > 0) {
    throw new SetupError(
      "features",
      `Unknown tool: ${unknown.join(", ")}.`,
      `Use any of: ${Object.keys(FEATURES).join(", ")}.`,
    );
  }
  if ((args.features || firstRun) && !args.yes && wanted.size === 0) {
    log("\nOptional tools (reading web pages is always on):");
    for (const [id, feature] of Object.entries(FEATURES)) {
      const on = feature.isOn(config);
      const answer = (await ask(`  ${feature.label}: ${feature.note}\n  Turn it on? [${on ? "Y/n" : "y/N"}] `)).toLowerCase();
      wanted.set(id, answer === "" ? on : answer.startsWith("y"));
    }
  }
  let emailFrom = args.emailFrom ?? config.vars().EMAIL_FROM ?? null;
  if (wanted.get("email") && !FEATURES.email.isOn(config) && !args.emailFrom && !args.yes) {
    emailFrom = (await ask("  Sender address for email (on your Email Service domain): ")) || emailFrom;
  }
  for (const [id, on] of wanted) {
    const feature = FEATURES[id];
    if (on && id === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailFrom ?? "")) {
      throw new SetupError(
        "features",
        "Email needs a sender address on a domain added to Cloudflare Email Service.",
        'Rerun with --email-from "powerhouse@your-domain.com".',
      );
    }
    if (on) {
      feature.turnOn(config, { emailFrom });
    } else {
      feature.turnOff(config);
    }
  }
  if (wanted.size > 0) {
    config.save();
  }
  const state = Object.fromEntries(Object.entries(FEATURES).map(([id, f]) => [id, f.isOn(config)]));
  const on = Object.entries(state)
    .filter(([, value]) => value)
    .map(([id]) => FEATURES[id].label);
  done("features", on.length > 0 ? on.join(", ") : "no optional tools on");
  return state;
}

/**
 * Setup cannot read the account's plan without billing permissions, so it
 * warns from the config: the browser tool needs a Worker Loader binding, and
 * Worker Loader (Dynamic Workers) is only on Workers Paid.
 */
function warnPaidFeatures() {
  const local = existsSync(LOCAL_CONFIG) ? stripJsoncComments(readFileSync(LOCAL_CONFIG, "utf8")) : "";
  if (/"worker_loaders"\s*:/.test(local)) {
    log(
      "  note: the browser tool is enabled, which needs the Workers Paid plan ($5/month)." +
        "\n        On Workers Free the deploy fails; remove \"browser\" and \"worker_loaders\" from" +
        "\n        wrangler.local.jsonc to deploy without it.",
    );
    steps.push({ detail: "browser tool needs Workers Paid", step: "plan-check" });
  }
}

/** Returns the workers.dev address Wrangler prints, if any. */
function deploy() {
  const { packageManager } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  log("Building and deploying...");
  const result = spawnSync("npx", ["--yes", packageManager, "run", "deploy"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: IS_WINDOWS,
    stdio: ["ignore", "pipe", "inherit"],
  });
  process.stderr.write(result.stdout ?? "");
  if (result.status !== 0) {
    throw new SetupError("deploy", "The deploy failed (see the output above).", "Fix the error shown, then rerun setup.");
  }
  done("deploy", "deployed");
  return result.stdout?.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0] ?? null;
}

/**
 * Web Push keys. The public key is a var deployed with the Worker; the
 * private key and the subject (the deployment's URL) are secrets, uploaded
 * after the deploy because a Worker must exist to hold secrets. Keys are kept
 * across reruns, since new keys break every browser's subscription; they are
 * only generated when the public key or a secret is missing, and then the
 * private key is held in memory until storePushSecrets.
 */
function preparePushKeys(worker) {
  const secrets = secretNames(worker);
  if (readLocalVars().VAPID_PUBLIC_KEY && secrets.has("VAPID_PRIVATE_KEY") && secrets.has("VAPID_SUBJECT")) {
    done("push", "notification keys already set");
    return null;
  }
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const publicKey = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x, "base64url"),
    Buffer.from(jwk.y, "base64url"),
  ]).toString("base64url");
  writeLocalConfig({ VAPID_PUBLIC_KEY: publicKey });
  return jwk.d;
}

function storePushSecrets(worker, privateKey, url) {
  if (!privateKey) {
    return;
  }
  // Piped on stdin, so the key is never on disk, in argv or in logs.
  const result = spawnSync("node", [WRANGLER, "secret", "bulk", "--name", worker], {
    cwd: ROOT,
    input: JSON.stringify({ VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: url }),
    stdio: ["pipe", args.json ? process.stderr : "inherit", "inherit"],
  });
  if (result.status !== 0) {
    throw new SetupError(
      "push",
      "Could not store the notification keys as Worker secrets (see the output above).",
      "Rerun setup; it creates new keys and tries again.",
    );
  }
  done("push", "notification keys created");
}

/** Names of the deployed Worker's secrets; empty when it does not exist yet. */
function secretNames(worker) {
  const result = spawnSync("node", [WRANGLER, "secret", "list", "--name", worker, "--format", "json"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status === 0) {
    return new Set(JSON.parse(result.stdout).map((secret) => secret.name));
  }
  // Only a Worker that does not exist yet has no secrets. Any other failure
  // (a network error) must not read as "no keys": setup would make new ones
  // and break every browser's subscription.
  if (/10007|does not exist|not found/i.test(`${result.stdout}${result.stderr}`)) {
    return new Set();
  }
  throw new SetupError(
    "push",
    "Could not check the Worker's secrets (see the output above).",
    "Rerun setup; if it keeps failing, check your connection to Cloudflare.",
  );
}

// Remove

const REMOVE_PERMISSIONS = [
  { key: "access", type: "edit" },
  { key: "workers_scripts", type: "edit" },
  { key: "aig", type: "edit" },
];

/**
 * --remove: deletes what powerhouse created for this deployment, in an order
 * that never leaves a half-removed app reachable: the Access application
 * first, then the members policy (unless another application uses it), the
 * Worker with its Durable Objects (all roles, jobs, settings and connection
 * tokens) and the AI Gateway (its stored provider keys and logs). Shared
 * things stay: Zero Trust, login methods, Email Service domains.
 */
async function removePowerhouse(account) {
  const worker = workerName();
  const gatewayId = readLocalVars().AI_GATEWAY_ID || "powerhouse";
  const token = await removeToken(account);
  const cf = cloudflare(token, account.id);
  const missing = (error) => {
    if (error instanceof SetupError && error.status === 404) {
      return null;
    }
    throw error;
  };

  const subdomain = (await cf.get("/workers/subdomain", "remove").catch(missing))?.subdomain;
  const hostname = subdomain ? `${worker}.${subdomain}.workers.dev` : null;
  const script = await cf.get(`/workers/scripts/${worker}/settings`, "remove").catch(missing);
  const apps = await cf.get("/access/apps", "remove");
  const app = hostname ? apps.find((a) => a.domain === hostname || a.self_hosted_domains?.includes(hostname)) : null;
  const policies = await cf.get("/access/policies", "remove");
  const policy = policies.find((p) => p.name === POLICY_NAME);
  const policyShared = Boolean(policy && apps.some((a) => a.id !== app?.id && (a.policies ?? []).some((p) => p.id === policy.id)));
  const gateway = await cf.get(`/ai-gateway/gateways/${gatewayId}`, "remove").catch(missing);

  const plan = [
    app && `Access application "${app.name}" for ${hostname}`,
    policy && !policyShared && `Access policy "${POLICY_NAME}"`,
    script && `Worker "${worker}" and all its data: roles, jobs, settings, members, schedules, connections`,
    gateway && `AI Gateway "${gatewayId}", with any provider keys and logs stored on it`,
  ].filter(Boolean);
  const kept = [
    "Cloudflare Zero Trust and its login methods",
    policyShared && `Access policy "${POLICY_NAME}" (another application uses it)`,
    "Email Service domains, and any Secrets Store",
    "Your GitHub repository, if you deployed with the button (delete it on GitHub)",
    "Grants to connected services such as Linear or Notion (revoke them there)",
  ].filter(Boolean);
  if (plan.length === 0) {
    done("remove", `nothing to remove: no Worker "${worker}", Access application or AI Gateway "${gatewayId}" found`);
    return { removed: [], kept };
  }

  log(`\nThis removes, for good, from the Cloudflare account "${account.name}":\n${plan.map((p) => `  - ${p}`).join("\n")}\nKept:\n${kept.map((k) => `  - ${k}`).join("\n")}\n`);
  if (!args.yes) {
    const answer = (await ask(`Type the Worker's name (${worker}) to remove it all, or anything else to stop: `)).trim();
    if (answer !== worker) {
      throw new SetupError("remove", "Nothing was removed.", "Rerun with --remove when you are sure.");
    }
  }

  const removed = [];
  if (app) {
    await cf.delete(`/access/apps/${app.id}`, "remove");
    removed.push(`Access application "${app.name}"`);
    done("remove", `deleted the Access application for ${hostname}`);
  }
  if (policy && !policyShared) {
    await cf.delete(`/access/policies/${policy.id}`, "remove");
    removed.push(`Access policy "${POLICY_NAME}"`);
    done("remove", `deleted the Access policy "${POLICY_NAME}"`);
  }
  if (script) {
    // force: also deletes the Durable Object namespaces the Worker implements.
    await cf.delete(`/workers/scripts/${worker}?force=true`, "remove");
    removed.push(`Worker "${worker}" and its data`);
    done("remove", `deleted the Worker "${worker}" and its data`);
  }
  if (gateway) {
    await cf.delete(`/ai-gateway/gateways/${gatewayId}`, "remove");
    removed.push(`AI Gateway "${gatewayId}"`);
    done("remove", `deleted the AI Gateway "${gatewayId}"`);
  }
  log(
    `\npowerhouse is removed. Delete the "powerhouse remove" API token now, and a "${worker} build token" if Deploy to Cloudflare made one: https://dash.cloudflare.com/profile/api-tokens` +
      "\nThis folder still has your settings (wrangler.local.jsonc); delete the folder if you are done with it.",
  );
  return { deleteRemoveToken: true, kept, removed };
}

async function removeToken(account) {
  const url = tokenUrl(account, REMOVE_PERMISSIONS, "powerhouse remove");
  let token = args.token ?? process.env.POWERHOUSE_SETUP_TOKEN;
  if (!token) {
    if (args.yes) {
      throw new SetupError(
        "remove-token",
        "Removing powerhouse needs a one-time API token that can delete its Access application, Worker and AI Gateway.",
        `Open ${url}, click "Continue to summary" and "Create token", copy the token, then rerun with it in the POWERHOUSE_SETUP_TOKEN environment variable (not on the command line).`,
      );
    }
    log(
      "\nRemoving powerhouse needs a one-time API token. Your browser will open the token page with the permissions filled in." +
        '\nClick "Continue to summary", then "Create token", and paste the token here. It is not saved.\n',
    );
    openUrl(url);
    token = await askHidden("API token: ");
  }
  const verify = await fetch(`${API}/user/tokens/verify`, { headers: { authorization: `Bearer ${token}` } })
    .then((r) => r.json())
    .catch(() => null);
  if (!verify?.success || verify.result?.status !== "active") {
    throw new SetupError("remove-token", "Cloudflare did not accept that API token.", `Create a new one at ${url} and paste the whole token.`);
  }
  done("remove-token", "verified");
  return token;
}

// Admins

/**
 * powerhouse admins change settings, roles and connections; other members
 * send jobs. ADMIN_EMAILS names admins that are always admins, so the org
 * cannot be locked out: by default the email you signed in to Cloudflare
 * with (which is also who may sign in by default). More admins are added in
 * Settings > Members. --admins replaces the list.
 */
function chooseAdmins(account) {
  const configured = readLocalVars().ADMIN_EMAILS;
  let admins = configured;
  if (args.admins) {
    const entries = args.admins
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const invalid = entries.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (entries.length === 0 || invalid.length > 0) {
      throw new SetupError(
        "admins",
        invalid.length > 0 ? `Not an email: ${invalid.join(", ")}` : "No admins given.",
        'Rerun with --admins "you@example.com" (comma-separated emails).',
      );
    }
    admins = entries.join(",");
  } else if (!admins && account.email) {
    admins = account.email.toLowerCase();
  }
  if (admins && admins !== configured) {
    writeLocalConfig({ ADMIN_EMAILS: admins });
  }
  done("admins", admins ? admins.split(",").join(", ") : "none yet: the first person to sign in becomes an admin");
  return admins ? admins.split(",") : [];
}

// AI Gateway

const AI_VENDORS = [
  { env: "POWERHOUSE_ANTHROPIC_KEY", label: "Anthropic", slug: "anthropic" },
  { env: "POWERHOUSE_OPENAI_KEY", label: "OpenAI", slug: "openai" },
];

/** True when this run has AI Gateway work to do, which needs the setup token. */
function aiGatewayNeedsToken(configured) {
  return (
    !(configured.AI_GATEWAY_ID && configured.AI_PROVIDERS) ||
    Boolean(args.aiBilling) ||
    AI_VENDORS.some((vendor) => process.env[vendor.env])
  );
}

/**
 * Jobs run on Claude or GPT through an AI Gateway that setup creates, with
 * authentication on (Unified Billing requires it) and logs off unless
 * --ai-logs. Three ways to pay for it:
 *
 * - "dashboard" (recommended): the person adds their Anthropic and/or
 *   OpenAI key to the gateway in the Cloudflare dashboard. Setup never sees
 *   a key, and its token needs no Secrets Store permission.
 * - "keys": they paste keys into setup, which stores them on the gateway
 *   through Secrets Store. Convenient, but the keys pass through this script.
 * - "credits": Cloudflare Unified Billing, which covers both vendors.
 *
 * Either way keys live only on the gateway, never in the Worker. Writes
 * AI_GATEWAY_ID, AI_PROVIDERS and AI_BILLING to the overlay.
 */
async function aiGateway(cf, worker, method, account) {
  const configured = readLocalVars();
  if (!method) {
    done("ai-gateway", `${configured.AI_GATEWAY_ID}: ${configured.AI_PROVIDERS} (${configured.AI_BILLING ?? "keys"})`);
    return {
      billing: configured.AI_BILLING ?? "keys",
      gateway: configured.AI_GATEWAY_ID,
      providers: configured.AI_PROVIDERS.split(","),
      // As of the last run that checked; null when none has.
      spendLimits: configured.AI_SPEND_LIMITS === "on" ? true : configured.AI_SPEND_LIMITS === "off" ? false : null,
    };
  }
  if (!cf) {
    throw new SetupError("ai-gateway", "Setting up the AI Gateway needs the setup API token.", "Rerun setup; it will ask for the token.");
  }
  const gatewayId = configured.AI_GATEWAY_ID ?? worker;
  const gateway = await ensureGateway(cf, gatewayId);

  let providers;
  if (method === "credits") {
    providers = AI_VENDORS.map((vendor) => vendor.slug);
  } else if (method === "keys") {
    const keys = await vendorKeys();
    if (keys.length > 0) {
      await storeKeys(cf, gateway, keys);
    }
    providers = (await storedProviders(cf, gatewayId)) ?? [];
    if (providers.length === 0) {
      throw new SetupError(
        "ai-gateway",
        "powerhouse needs an Anthropic or OpenAI API key to run jobs, and none is stored on the gateway yet.",
        "Rerun with your key in POWERHOUSE_ANTHROPIC_KEY or POWERHOUSE_OPENAI_KEY (not on the command line), or add it in the dashboard and rerun with --ai-billing dashboard.",
      );
    }
  } else {
    providers = await dashboardProviders(cf, gatewayId, account);
  }
  const billing = method === "credits" ? "credits" : "keys";
  // Budgets belong on the gateway; setup only checks for them and says so.
  const spendLimits = Boolean(gateway.spend_limits?.enabled && gateway.spend_limits.rules?.some((rule) => rule.enabled !== false));
  if (!spendLimits) {
    log(
      `\nYour AI Gateway has no spend limit. Set one so a runaway job cannot run up a bill: in the Cloudflare dashboard (https://dash.cloudflare.com/${account.id}/ai/ai-gateway), open the "${gatewayId}" gateway, then Settings > Spend limits, and add a rule (for example a monthly cap).`,
    );
  }
  writeLocalConfig({
    AI_BILLING: billing,
    AI_GATEWAY_ID: gatewayId,
    AI_PROVIDERS: providers.join(","),
    AI_SPEND_LIMITS: spendLimits ? "on" : "off",
  });
  done("ai-gateway", `${gatewayId}: ${providers.join(", ")} (${billing === "credits" ? "Cloudflare credits" : "your API keys"})`);
  return { billing, gateway: gatewayId, providers, spendLimits };
}

/**
 * Waits for the person to add keys in the dashboard, then reads which
 * vendors have one. The listing shows vendor names, never keys. If the
 * token may not list them, the person says which vendors they added
 * (--ai-providers when not interactive).
 */
async function dashboardProviders(cf, gatewayId, account) {
  const page = `https://dash.cloudflare.com/${account.id}/ai/ai-gateway`;
  const howTo = `In the Cloudflare dashboard, open AI > AI Gateway (${page}), select the "${gatewayId}" gateway, open Provider Keys, and add your Anthropic and/or OpenAI API key.`;
  for (let attempt = 0; ; attempt++) {
    const stored = await storedProviders(cf, gatewayId);
    if (stored === null) {
      return declaredProviders(howTo);
    }
    if (stored.length > 0) {
      return stored;
    }
    if (args.yes || attempt >= 3) {
      throw new SetupError(
        "ai-gateway",
        `The "${gatewayId}" AI Gateway is ready, but no Anthropic or OpenAI key is on it yet.`,
        `${howTo} Then rerun setup with the same flags.`,
      );
    }
    log(`\n${howTo}\nYour keys stay in Cloudflare; setup never sees them.`);
    openUrl(page);
    await ask("Press Enter once you have added a key: ");
  }
}

/** Vendors with a key stored on the gateway, or null when the token may not list them. */
async function storedProviders(cf, gatewayId) {
  const configs = await cf.get(`/ai-gateway/gateways/${gatewayId}/provider_configs`, "ai-gateway").catch((error) => {
    if (error instanceof SetupError && error.status === 403) {
      return null;
    }
    throw error;
  });
  return configs && AI_VENDORS.filter((vendor) => configs.some((c) => c.provider_slug === vendor.slug)).map((vendor) => vendor.slug);
}

async function declaredProviders(howTo) {
  const listed = args.aiProviders ?? (args.yes ? "" : await ask(`\n${howTo}\nWhich did you add? (anthropic, openai, or both): `));
  const providers = AI_VENDORS.filter((vendor) => listed.toLowerCase().includes(vendor.slug)).map((vendor) => vendor.slug);
  if (providers.length === 0) {
    throw new SetupError(
      "ai-gateway",
      "Setup could not tell which API keys are on the gateway.",
      `${howTo} Then rerun with --ai-providers anthropic, openai or "anthropic,openai".`,
    );
  }
  return providers;
}

async function aiBilling(configured) {
  const choice = args.aiBilling ?? (AI_VENDORS.some((vendor) => process.env[vendor.env]) ? "keys" : null);
  if (choice === "dashboard" || choice === "keys" || choice === "credits") {
    return choice;
  }
  if (choice) {
    throw new SetupError("ai-gateway", `Unknown --ai-billing "${choice}".`, "Use --ai-billing dashboard, keys or credits.");
  }
  if (args.yes) {
    throw new SetupError(
      "ai-gateway",
      "powerhouse runs jobs on Claude or GPT through an AI Gateway, which needs a way to pay for them.",
      "Rerun with --ai-billing dashboard (recommended: you add your Anthropic or OpenAI key to the gateway in the Cloudflare dashboard, and setup never sees it) or --ai-billing credits (Cloudflare credits, bought in the dashboard under AI > AI Gateway > Credits).",
    );
  }
  log(
    `\npowerhouse runs jobs on Claude (or GPT) through a Cloudflare AI Gateway${configured.AI_GATEWAY_ID ? "" : " that setup creates"}. How should it pay for them?` +
      "\n  1. Your Anthropic and/or OpenAI API key, added in the Cloudflare dashboard (recommended: setup never sees it)" +
      "\n  2. Your API key, pasted here; setup stores it on the gateway for you" +
      "\n  3. Cloudflare credits (Unified Billing; buy them in the dashboard, no other account needed)",
  );
  const answer = await ask("Choose 1, 2 or 3 [1]: ");
  return answer === "2" ? "keys" : answer === "3" ? "credits" : "dashboard";
}

/** Keys from the environment, or asked for (hidden) when running interactively. */
async function vendorKeys() {
  const keys = [];
  for (const vendor of AI_VENDORS) {
    let key = process.env[vendor.env]?.trim();
    if (!key && !args.yes) {
      key = (await askHidden(`${vendor.label} API key (Enter to skip): `)).trim();
    }
    if (key) {
      keys.push({ key, slug: vendor.slug });
    }
  }
  return keys;
}

/** The gateway, created when missing; authentication is required for Unified Billing. */
async function ensureGateway(cf, id) {
  const settings = {
    authentication: true,
    cache_invalidate_on_update: false,
    cache_ttl: 0,
    collect_logs: args.aiLogs,
    rate_limiting_interval: 0,
    rate_limiting_limit: 0,
  };
  const existing = await cf.get(`/ai-gateway/gateways/${id}`, "ai-gateway").catch((error) => {
    if (error instanceof SetupError && error.status === 404) {
      return null;
    }
    throw aiPermissionError(error);
  });
  if (!existing) {
    return cf.post("/ai-gateway/gateways", { id, ...settings }, "ai-gateway").catch((error) => {
      throw aiPermissionError(error);
    });
  }
  if (!existing.authentication || existing.collect_logs !== args.aiLogs) {
    return cf.put(`/ai-gateway/gateways/${id}`, gatewaySettings(existing, settings), "ai-gateway");
  }
  return existing;
}

/**
 * Stores each key as the gateway's default for its vendor. Keys live in a
 * Secrets Store (created when the account has none) attached to the
 * gateway; a key given again replaces the stored one.
 */
async function storeKeys(cf, gateway, keys) {
  if (!gateway.store_id) {
    const stores = await cf.get("/secrets_store/stores", "ai-gateway").catch((error) => {
      throw aiPermissionError(error);
    });
    const store = stores[0] ?? (await cf.post("/secrets_store/stores", { name: "powerhouse" }, "ai-gateway"));
    gateway = await cf.put(`/ai-gateway/gateways/${gateway.id}`, gatewaySettings(gateway, { store_id: store.id }), "ai-gateway");
  }
  const existing = await cf.get(`/ai-gateway/gateways/${gateway.id}/provider_configs`, "ai-gateway");
  for (const { key, slug } of keys) {
    for (const config of existing.filter((c) => c.provider_slug === slug && c.alias === "default")) {
      await cf.delete(`/ai-gateway/gateways/${gateway.id}/provider_configs/${config.id}`, "ai-gateway");
    }
    await cf
      .post(
        `/ai-gateway/gateways/${gateway.id}/provider_configs`,
        { alias: "default", default_config: true, provider_slug: slug, secret: key },
        "ai-gateway",
      )
      .catch((error) => {
        throw aiPermissionError(error);
      });
  }
}

/**
 * An update body: the gateway's current settings with changes applied,
 * leaving out read-only fields (id, timestamps) the API sends back. Every
 * setting the person may have changed in the dashboard is carried over,
 * spend limits above all: an update must never drop their budgets.
 */
function gatewaySettings(current, changes) {
  const fields = [
    "authentication",
    "byok_only",
    "cache_invalidate_on_update",
    "cache_ttl",
    "collect_logs",
    "log_management",
    "log_management_strategy",
    "logpush",
    "logpush_public_key",
    "rate_limiting_interval",
    "rate_limiting_limit",
    "rate_limiting_technique",
    "spend_limits",
    "store_id",
    "workers_ai_billing_mode",
    "zdr",
  ];
  const merged = { ...current, ...changes };
  return Object.fromEntries(fields.filter((field) => merged[field] !== undefined && merged[field] !== null).map((field) => [field, merged[field]]));
}

function aiPermissionError(error) {
  if (error instanceof SetupError && error.status === 403) {
    return new SetupError(
      "ai-gateway",
      "The API token cannot manage AI Gateway or Secrets Store.",
      "Edit the token in the Cloudflare dashboard (My Profile > API Tokens) and add Account > AI Gateway > Edit, plus Account > Secrets Store > Edit if setup stores your keys (--ai-billing keys). Then rerun and paste the same token.",
    );
  }
  return error;
}

/** A fresh workers.dev hostname can take a minute to resolve; Access should answer with a redirect to sign-in. */
async function verifyProtected(url, teamDomain) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await fetch(url, { redirect: "manual" }).catch(() => null);
    const location = response?.headers.get("location") ?? "";
    if (response && response.status >= 300 && response.status < 400 && location.includes(teamDomain)) {
      done("verify", "Access is protecting powerhouse");
      return;
    }
    if (response?.status === 200) {
      throw new SetupError(
        "verify",
        `${url} answered without asking anyone to sign in.`,
        "Check in Zero Trust > Access controls > Applications that the powerhouse application lists this hostname, then rerun setup.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new SetupError(
    "verify",
    `${url} did not answer within a minute.`,
    "New workers.dev hostnames can take a few minutes. Open the URL in a moment; rerun setup if it still fails.",
  );
}

// wrangler.local.jsonc

/** The overlay's string vars; enough to tell what setup already configured. */
function readLocalVars() {
  return existsSync(LOCAL_CONFIG) ? localConfig().vars() : {};
}

/** Sets string vars in the overlay, creating it when missing. */
function writeLocalConfig(values) {
  const created = !existsSync(LOCAL_CONFIG);
  const config = localConfig();
  config.setVars(values);
  config.save();
  done("config", `${created ? "created" : "updated"} wrangler.local.jsonc`);
}

/**
 * An editor for wrangler.local.jsonc that changes the text in place, so the
 * operator's comments and formatting survive. Entries are found in a copy
 * with comments blanked out, so a key mentioned in a comment is never
 * mistaken for the real one.
 */
function localConfig() {
  let text = existsSync(LOCAL_CONFIG)
    ? readFileSync(LOCAL_CONFIG, "utf8")
    : "// Your deployment's settings (gitignored), written by setup.mjs. See\n// wrangler.local.example.jsonc for every option.\n{\n}\n";
  const entries = (objectStart) => topLevelEntries(blankJsoncComments(text), objectStart);
  const rootStart = () => blankJsoncComments(text).indexOf("{");
  const varsEntry = () => entries(rootStart()).get("vars");
  /** Inserts entry lines after an object's opening brace. */
  const insertInto = (objectStart, lines, indent) => {
    const at = objectStart + 1;
    const body = lines.map((line) => `${indent}${line}`).join(",\n");
    const empty = /^\s*\}/.exec(blankJsoncComments(text).slice(at));
    text = empty
      ? `${text.slice(0, at)}\n${body}\n${indent.slice(2)}${text.slice(at + empty[0].length - 1)}`
      : `${text.slice(0, at)}\n${body},${text.slice(at)}`;
  };
  return {
    has: (key) => entries(rootStart()).has(key),
    set(key, value) {
      const entry = entries(rootStart()).get(key);
      const json = inlineJson(value);
      if (entry) {
        text = text.slice(0, entry.valueStart) + json + text.slice(entry.valueEnd);
      } else {
        insertInto(rootStart(), [`${JSON.stringify(key)}: ${json}`], "  ");
      }
    },
    remove(key) {
      const entry = entries(rootStart()).get(key);
      if (entry) {
        text = text.slice(0, entry.removeStart) + text.slice(entry.removeEnd);
      }
    },
    vars() {
      const entry = varsEntry();
      const vars = {};
      if (entry) {
        const masked = blankJsoncComments(text);
        for (const [key, value] of entries(entry.valueStart)) {
          const raw = masked.slice(value.valueStart, value.valueEnd);
          if (raw.startsWith('"')) {
            vars[key] = JSON.parse(raw);
          }
        }
      }
      return vars;
    },
    setVars(values) {
      const missing = [];
      for (const [key, value] of Object.entries(values)) {
        const entry = varsEntry() && entries(varsEntry().valueStart).get(key);
        if (entry) {
          text = text.slice(0, entry.valueStart) + JSON.stringify(value) + text.slice(entry.valueEnd);
        } else {
          missing.push(`${JSON.stringify(key)}: ${JSON.stringify(value)}`);
        }
      }
      if (missing.length === 0) {
        return;
      }
      if (varsEntry()) {
        insertInto(varsEntry().valueStart, missing, "    ");
      } else {
        insertInto(rootStart(), [`"vars": {\n${missing.map((line) => `    ${line}`).join(",\n")}\n  }`], "  ");
      }
    },
    save: () => writeFileSync(LOCAL_CONFIG, text),
  };
}

/** JSON on one line with a space after colons and commas, like the hand-written config. */
function inlineJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(inlineJson).join(", ")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{ ${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${inlineJson(item)}`)
      .join(", ")} }`;
  }
  return JSON.stringify(value);
}

/**
 * The entries of the object whose `{` is at `objectStart`, in comment-blanked
 * JSONC: for each key, where its value starts and ends, and the span to cut
 * to remove the whole entry with its comma.
 */
function topLevelEntries(masked, objectStart) {
  const result = new Map();
  let i = objectStart + 1;
  const skipSpace = () => {
    while (i < masked.length && /\s/.test(masked[i])) i++;
  };
  const skipString = () => {
    i++;
    while (i < masked.length && masked[i] !== '"') i += masked[i] === "\\" ? 2 : 1;
    i++;
  };
  while (i < masked.length) {
    skipSpace();
    if (masked[i] === "}" || i >= masked.length) break;
    if (masked[i] === ",") {
      i++;
      continue;
    }
    const keyStart = i;
    skipString();
    const key = JSON.parse(masked.slice(keyStart, i));
    skipSpace();
    i++; // the colon
    skipSpace();
    const valueStart = i;
    let depth = 0;
    while (i < masked.length) {
      const char = masked[i];
      if (char === '"') {
        skipString();
        continue;
      }
      if (char === "{" || char === "[") depth++;
      else if (char === "}" || char === "]") {
        if (depth === 0) break;
        depth--;
      } else if (char === "," && depth === 0) break;
      i++;
    }
    let valueEnd = i;
    while (/\s/.test(masked[valueEnd - 1])) valueEnd--;
    // The span that removes the whole entry: from the start of its line
    // through its comma and the rest of that line; or, for the last entry,
    // from the previous entry's comma, so no trailing comma is left behind.
    const lineStart = Math.max(masked.lastIndexOf("\n", keyStart), objectStart) + 1;
    let removeStart = lineStart;
    let removeEnd = valueEnd;
    if (masked[i] === ",") {
      const newline = masked.indexOf("\n", i);
      removeEnd = newline !== -1 && masked.slice(i + 1, newline).trim() === "" ? newline + 1 : i + 1;
    } else {
      const previous = masked.slice(objectStart + 1, keyStart).trimEnd();
      removeStart = previous.endsWith(",") ? objectStart + previous.length : Math.max(lineStart - 1, objectStart + 1);
    }
    result.set(key, { removeEnd, removeStart, valueEnd, valueStart });
  }
  return result;
}

/** Removes // and /* *\/ comments outside strings. */
function stripJsoncComments(text) {
  return text.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match, string) => string ?? "");
}

/** Replaces comments outside strings with spaces, keeping every offset and line break. */
function blankJsoncComments(text) {
  return text.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match, string) =>
    string ?? match.replace(/[^\n]/g, " "),
  );
}

// Cloudflare API

function cloudflare(token, accountId) {
  /** @param {unknown} [body] */
  const call = async (method, path, step, body) => {
    if (!token) {
      throw new SetupError(
        step,
        "This step needs the one-time setup API token.",
        "Rerun setup with the token in the POWERHOUSE_SETUP_TOKEN environment variable (setup prints where to create one when it is missing).",
      );
    }
    const response = await fetch(`${API}/accounts/${accountId}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method,
    }).catch(() => null);
    const json = response ? await response.json().catch(() => null) : null;
    if (!json?.success) {
      const detail = json?.errors?.map((e) => e.message).join("; ") || `HTTP ${response?.status ?? "no response"}`;
      const error = new SetupError(
        step,
        `Cloudflare refused the request (${detail}).`,
        response?.status === 403
          ? "The API token is missing a permission. Create a new one from the link setup prints and rerun."
          : "Rerun setup; if it fails again, open an issue with this message.",
      );
      error.status = response?.status;
      throw error;
    }
    return json.result;
  };
  return {
    get: (path, step) => call("GET", path, step),
    post: (path, body, step) => call("POST", path, step, body),
    put: (path, body, step) => call("PUT", path, step, body),
    delete: (path, step) => call("DELETE", path, step),
  };
}

// Process and terminal helpers

function whoami() {
  const result = spawnSync("node", [WRANGLER, "whoami", "--json"], { cwd: ROOT, encoding: "utf8" });
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { loggedIn: false };
  }
}

/**
 * Child output goes to stderr in --json mode, keeping stdout for the result.
 * Children get no stdin: none of them needs input (sign-in finishes in the
 * browser), and an inherited stdin would swallow answers piped to setup.
 */
function run(command, commandArgs, { cwd }) {
  return spawnSync(command, commandArgs, {
    cwd,
    // Windows needs a shell only to find npx.cmd; without one, paths with
    // spaces (C:\Users\Jane Doe\...) stay single arguments.
    shell: IS_WINDOWS && command !== "node",
    stdio: ["ignore", args.json ? process.stderr : "inherit", "inherit"],
  });
}

function openUrl(url) {
  // Not "cmd /c start": cmd splits a URL at its "&" characters.
  const [command, commandArgs] = IS_WINDOWS
    ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
    : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
  const result = spawnSync(command, commandArgs, { stdio: "ignore" });
  if (result.status !== 0) {
    log(`Open this link in your browser: ${url}`);
  }
}

/**
 * One readline interface for the whole run: a new one per question would
 * read ahead and drop answers piped in on stdin. Answers past the end of
 * input read as empty, which keeps each default.
 */
let prompts = null;
let inputEnded = false;

async function ask(question) {
  if (inputEnded) {
    process.stderr.write(`${question}\n`);
    return "";
  }
  if (!prompts) {
    prompts = createInterface({ input: process.stdin, output: process.stderr });
    prompts.on("close", () => {
      inputEnded = true;
      prompts = null;
    });
  }
  const answer = await new Promise((resolve) => {
    const onClose = () => resolve("");
    prompts.once("close", onClose);
    prompts.question(question, (value) => {
      prompts?.off("close", onClose);
      resolve(value);
    });
  });
  return answer.trim();
}

function closePrompts() {
  prompts?.close();
}

/** Reads a line without echoing it, for the API token. */
function askHidden(question) {
  if (!process.stdin.isTTY) {
    return ask(question);
  }
  // Raw mode and readline cannot share stdin.
  closePrompts();
  inputEnded = false;
  process.stderr.write(question);
  return new Promise((resolve) => {
    let value = "";
    const { stdin } = process;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stderr.write("\n");
          resolve(value.trim());
          return;
        }
        if (char === "\u0003") {
          process.exit(130);
        }
        value = char === "\u007f" ? value.slice(0, -1) : value + char;
      }
    };
    stdin.on("data", onData);
  });
}

function done(step, detail) {
  steps.push({ detail, step });
  log(`  ok  ${step}: ${detail}`);
}

function log(message) {
  process.stderr.write(`${message}\n`);
}

function parseArgs(argv) {
  const parsed = {
    account: null,
    update: false,
    remove: false,
    aiBilling: null,
    aiLogs: false,
    aiProviders: null,
    admins: null,
    allow: null,
    disable: [],
    emailFrom: null,
    enable: [],
    features: false,
    help: false,
    json: false,
    skipDeploy: false,
    token: null,
    yes: false,
  };
  const list = (value) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) {
        throw new Error(`${arg} needs a value`);
      }
      return next;
    };
    if (arg === "--allow") parsed.allow = value();
    else if (arg === "--ai-billing") parsed.aiBilling = value();
    else if (arg === "--admins") parsed.admins = value();
    else if (arg === "--update") parsed.update = true;
    else if (arg === "--remove") parsed.remove = true;
    else if (arg === "--ai-logs") parsed.aiLogs = true;
    else if (arg === "--ai-providers") parsed.aiProviders = value();
    else if (arg === "--account") parsed.account = value();
    else if (arg === "--token") parsed.token = value();
    else if (arg === "--features") parsed.features = true;
    else if (arg === "--enable") parsed.enable.push(...list(value()));
    else if (arg === "--disable") parsed.disable.push(...list(value()));
    else if (arg === "--email-from") parsed.emailFrom = value();
    else if (arg === "--skip-deploy") parsed.skipDeploy = true;
    else if (arg === "--yes") parsed.yes = true;
    else if (arg === "--json") parsed.json = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else {
      process.stderr.write(`Unknown option: ${arg}\n\n${HELP}`);
      process.exit(2);
    }
  }
  return parsed;
}
