/**
 * Stands in for `just-bash` in the Worker build (see vite.config.ts). The
 * Agents SDK's skill script runner imports it (and Think's workspace shell
 * did before Think 0.21), but powerhouse never runs skill scripts and limits
 * jobs to their role's tools, so the real package (about 14% of the Worker's
 * source) would be dead weight under the Workers Free size limit. Reaching
 * that path fails loudly instead of silently doing nothing.
 */
const UNAVAILABLE = "just-bash is left out of powerhouse's build: the workspace shell and skill scripts are off.";

export class Bash {
  constructor() {
    throw new Error(UNAVAILABLE);
  }
}

export function defineCommand(): never {
  throw new Error(UNAVAILABLE);
}
