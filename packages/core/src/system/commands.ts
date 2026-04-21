import { execa } from 'execa';

import { detectPlatform, type PlatformTarget } from '../platform/detect.ts';
import type { CommandCheck } from '../registry/schema.ts';

export async function commandExists(command: string, platform = currentPlatform()): Promise<boolean> {
  return (await resolveCommandPath(command, platform)) !== null;
}

export async function resolveCommandPath(command: string, platform = currentPlatform()): Promise<string | null> {
  try {
    const result = await execa(platform === 'win32' ? 'where' : 'which', [command], {
      stdout: 'pipe',
      stderr: 'ignore',
      windowsHide: true
    });
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null;
  } catch {
    return null;
  }
}

export async function commandCheckSucceeds(check: CommandCheck, platform = currentPlatform()): Promise<boolean> {
  try {
    await execa(check.command, check.args, {
      stdout: 'ignore',
      stderr: 'ignore',
      windowsHide: platform === 'win32'
    });
    return true;
  } catch {
    return false;
  }
}

export async function resolveSkillsRunner(platform = currentPlatform()): Promise<'npx' | 'bunx' | null> {
  if (await commandExists('npx', platform)) {
    return 'npx';
  }
  if (await commandExists('bunx', platform)) {
    return 'bunx';
  }
  return null;
}

function currentPlatform(): PlatformTarget {
  const detected = detectPlatform();
  return detected.os === 'unknown' ? 'linux' : detected.os;
}
