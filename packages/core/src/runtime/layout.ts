import fsSync from 'node:fs';
import path from 'node:path';

import type { DetectedPlatform } from '../platform/detect.ts';

export const POWERHOUSE_SHELL_START_MARKER = '# >>> powerhouse shell setup >>>';
export const POWERHOUSE_SHELL_END_MARKER = '# <<< powerhouse shell setup <<<';

export function normalizeShellName(shell: string): string {
  const value = path.basename(shell || '').trim().toLowerCase();
  return value.length > 0 ? value : 'unknown';
}

export function getWrapperBinDir(platform: DetectedPlatform, env: NodeJS.ProcessEnv = process.env): string {
  if (platform.os === 'win32') {
    const localAppData = env.LOCALAPPDATA ?? path.join(platform.homeDir, 'AppData', 'Local');
    return env.POWERHOUSE_BIN_DIR ?? path.join(localAppData, 'powerhouse', 'bin');
  }
  return env.POWERHOUSE_BIN_DIR ?? env.XDG_BIN_HOME ?? path.join(platform.homeDir, '.local', 'bin');
}

export function getWrapperPath(platform: DetectedPlatform, env: NodeJS.ProcessEnv = process.env): string {
  if (platform.os === 'win32') {
    return path.join(getWrapperBinDir(platform, env), 'powerhouse.cmd');
  }
  return path.join(getWrapperBinDir(platform, env), 'powerhouse');
}

export function getShellTargetFile(
  platform: DetectedPlatform,
  env: NodeJS.ProcessEnv = process.env,
  shellName = normalizeShellName(platform.shell)
): string {
  if (platform.os === 'win32') {
    const documents = path.join(platform.homeDir, 'Documents');
    const ps7Profile = path.join(documents, 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
    const ps5Profile = path.join(documents, 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
    if (fsSync.existsSync(ps7Profile) || fsSync.existsSync(path.dirname(ps7Profile))) {
      return ps7Profile;
    }
    if (fsSync.existsSync(ps5Profile) || fsSync.existsSync(path.dirname(ps5Profile))) {
      return ps5Profile;
    }
    return ps7Profile;
  }

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
