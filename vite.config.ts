import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import agents from "agents/vite";
import { defineConfig, type Plugin } from "vite";
import { wranglerConfigPath } from "./config/merge-wrangler.ts";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/** Swaps `just-bash` for a stub; see config/just-bash-stub.ts for why. */
function stubJustBash(): Plugin {
  const stub = fileURLToPath(new URL("./config/just-bash-stub.ts", import.meta.url));
  return {
    enforce: "pre",
    name: "powerhouse-stub-just-bash",
    resolveId: (source) => (source === "just-bash" ? stub : null),
  };
}

export default defineConfig(({ command }) => ({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    stubJustBash(),
    agents(),
    react(),
    cloudflare({ configPath: wranglerConfigPath(import.meta.dirname, { dev: command === "serve" }) }),
  ],
}));
