import os from 'node:os';
import path from 'node:path';

export const PLATFORM_TARGETS = ['darwin', 'linux', 'win32', 'wsl'] as const;
export const SETUP_PLATFORMS = ['darwin', 'linux', 'wsl', 'win32'] as const;

export type PlatformTarget = (typeof PLATFORM_TARGETS)[number];
export type SetupPlatform = (typeof SETUP_PLATFORMS)[number];
export type BootstrapPlatform = SetupPlatform;
export type Platform = PlatformTarget | 'unknown';

export interface DetectedPlatform {
  os: Platform;
  arch: string;
  shell: string;
  homeDir: string;
  xdgConfigHome: string;
  xdgDataHome: string;
  xdgCacheHome: string;
  xdgStateHome: string;
}

export function detectPlatform(
  env: NodeJS.ProcessEnv = process.env,
  runtimePlatform: NodeJS.Platform = process.platform,
  release: string = os.release()
): DetectedPlatform {
  const shell = env.SHELL ?? env.ComSpec ?? 'unknown';
  const homeDir = os.homedir();
  const xdgConfigHome = env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config');
  const xdgDataHome = env.XDG_DATA_HOME ?? path.join(homeDir, '.local', 'share');
  const xdgCacheHome = env.XDG_CACHE_HOME ?? path.join(homeDir, '.cache');
  const xdgStateHome = env.XDG_STATE_HOME ?? path.join(homeDir, '.local', 'state');

  let detected: Platform = 'unknown';
  if (runtimePlatform === 'darwin') {
    detected = 'darwin';
  } else if (runtimePlatform === 'win32') {
    detected = 'win32';
  } else if (runtimePlatform === 'linux') {
    detected = release.toLowerCase().includes('microsoft') ? 'wsl' : 'linux';
  }

  return {
    os: detected,
    arch: os.arch(),
    shell,
    homeDir,
    xdgConfigHome,
    xdgDataHome,
    xdgCacheHome,
    xdgStateHome
  };
}

export function isPlanPlatform(platform: DetectedPlatform): platform is DetectedPlatform & { os: PlatformTarget } {
  return PLATFORM_TARGETS.includes(platform.os as PlatformTarget);
}

export function isSetupPlatform(platform: DetectedPlatform): platform is DetectedPlatform & { os: SetupPlatform } {
  return SETUP_PLATFORMS.includes(platform.os as SetupPlatform);
}

export const BOOTSTRAP_PLATFORMS = SETUP_PLATFORMS;
export const isBootstrapPlatform = isSetupPlatform;

export function isNativeWindowsPlatform(platform: DetectedPlatform): platform is DetectedPlatform & { os: 'win32' } {
  return platform.os === 'win32';
}
