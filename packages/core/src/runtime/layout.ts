import path from 'node:path';

import type { DetectedPlatform } from '../platform/detect.ts';

export const POWERHOUSE_SHELL_START_MARKER = '# >>> powerhouse shell setup >>>';
export const POWERHOUSE_SHELL_END_MARKER = '# <<< powerhouse shell setup <<<';

export function normalizeShellName(shell: string): string {
  const value = path.basename(shell || '').trim().toLowerCase();
  return value.length > 0 ? value : 'unknown';
}

export function getWrapperBinDir(platform: DetectedPlatform, env: NodeJS.ProcessEnv = process.env): string {
  return env.POWERHOUSE_BIN_DIR ?? env.XDG_BIN_HOME ?? path.join(platform.homeDir, '.local', 'bin');
}

export function getWrapperPath(platform: DetectedPlatform, env: NodeJS.ProcessEnv = process.env): string {
  return path.join(getWrapperBinDir(platform, env), 'powerhouse');
}

export function getShellTargetFile(
  platform: DetectedPlatform,
  env: NodeJS.ProcessEnv = process.env,
  shellName = normalizeShellName(platform.shell)
): string {
  switch (shellName) {
    case 'bash':
      return path.join(platform.homeDir, '.bashrc');
    case 'zsh':
      return path.join(platform.homeDir, '.zshrc');
    case 'fish':
      return path.join(platform.xdgConfigHome, 'fish', 'config.fish');
    default:
      return path.join(platform.homeDir, '.profile');
  }
}
