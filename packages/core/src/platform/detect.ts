import os from 'node:os';
import path from 'node:path';

export type SupportedPlatform = 'darwin' | 'linux';
export type Platform = SupportedPlatform | 'wsl' | 'unknown';

export interface DetectedPlatform {
  os: Platform;
  arch: string;
  shell: string;
  homeDir: string;
  xdgConfigHome: string;
  xdgCacheHome: string;
  xdgStateHome: string;
}

export function detectPlatform(env: NodeJS.ProcessEnv = process.env): DetectedPlatform {
  const shell = env.SHELL ?? 'unknown';
  const homeDir = os.homedir();
  const xdgConfigHome = env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config');
  const xdgCacheHome = env.XDG_CACHE_HOME ?? path.join(homeDir, '.cache');
  const xdgStateHome = env.XDG_STATE_HOME ?? path.join(homeDir, '.local', 'state');

  let detected: Platform = 'unknown';
  if (process.platform === 'darwin') {
    detected = 'darwin';
  } else if (process.platform === 'linux') {
    const release = os.release().toLowerCase();
    detected = release.includes('microsoft') ? 'wsl' : 'linux';
  }

  return {
    os: detected,
    arch: os.arch(),
    shell,
    homeDir,
    xdgConfigHome,
    xdgCacheHome,
    xdgStateHome
  };
}

export function isSupportedPlatform(platform: DetectedPlatform): platform is DetectedPlatform & { os: SupportedPlatform } {
  return platform.os === 'darwin' || platform.os === 'linux';
}

