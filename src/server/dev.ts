/**
 * Local development only. On localhost there is no Cloudflare Access in front
 * of powerhouse, so `bun run dev` signs everyone in as one dev user. Callers
 * guard on `import.meta.env.DEV`, which Vite sets to false for production
 * builds and then removes the guarded code, so a deployment contains no
 * sign-in bypass at all.
 */
export function devEmail(env: Env) {
  const configured = (env as Env & { DEV_AUTH_EMAIL?: string }).DEV_AUTH_EMAIL;
  return (configured || "dev@localhost").toLowerCase();
}
