import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import agents from "agents/vite";
import { defineConfig } from "vite";
import { wranglerConfigPath } from "./config/merge-wrangler";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig(({ command }) => ({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    agents(),
    react(),
    cloudflare({ configPath: wranglerConfigPath(import.meta.dirname, { dev: command === "serve" }) }),
  ],
}));
