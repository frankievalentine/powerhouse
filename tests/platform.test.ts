import { describe, expect, it } from 'vitest';

import { detectPlatform, getPowerhousePaths } from '../packages/core/src/index.ts';

describe('platform detection', () => {
  it('detects native Windows via process platform', () => {
    const platform = detectPlatform(
      {
        ComSpec: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
      },
      'win32',
      '10.0.22631'
    );

    expect(platform.os).toBe('win32');
    expect(platform.shell.toLowerCase()).toContain('powershell');
  });

  it('detects WSL from a Linux runtime with a Microsoft kernel release', () => {
    const platform = detectPlatform(
      {
        SHELL: '/bin/bash'
      },
      'linux',
      '5.15.167.4-microsoft-standard-WSL2'
    );

    expect(platform.os).toBe('wsl');
    expect(platform.shell).toBe('/bin/bash');
  });
});

describe('platform paths', () => {
  it('uses Windows roaming and local app data paths on native Windows', () => {
    const paths = getPowerhousePaths(
      {
        os: 'win32',
        arch: 'x64',
        shell: 'powershell.exe',
        homeDir: 'C:\\Users\\frankie',
        xdgConfigHome: '/ignored/config',
        xdgDataHome: '/ignored/data',
        xdgCacheHome: '/ignored/cache',
        xdgStateHome: '/ignored/state'
      },
      {
        APPDATA: 'C:\\Users\\frankie\\AppData\\Roaming',
        LOCALAPPDATA: 'C:\\Users\\frankie\\AppData\\Local'
      }
    );

    expect(paths.configDir).toBe('C:\\Users\\frankie\\AppData\\Roaming\\powerhouse');
    expect(paths.dataDir).toBe('C:\\Users\\frankie\\AppData\\Local\\powerhouse\\data');
    expect(paths.cacheDir).toBe('C:\\Users\\frankie\\AppData\\Local\\powerhouse\\cache');
    expect(paths.stateDir).toBe('C:\\Users\\frankie\\AppData\\Local\\powerhouse\\state');
  });
});
