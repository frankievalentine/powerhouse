import fs from 'node:fs/promises';

import { POWERHOUSE_SHELL_END_MARKER, POWERHOUSE_SHELL_START_MARKER } from './layout.ts';

export async function removeManagedShellBlock(filePath: string): Promise<boolean> {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }

  const lines = content.split(/\r?\n/);
  const nextLines: string[] = [];
  let skipping = false;
  let removed = false;

  for (const line of lines) {
    if (line === POWERHOUSE_SHELL_START_MARKER) {
      skipping = true;
      removed = true;
      continue;
    }

    if (skipping && line === POWERHOUSE_SHELL_END_MARKER) {
      skipping = false;
      continue;
    }

    if (!skipping) {
      nextLines.push(line);
    }
  }

  if (!removed) {
    return false;
  }

  const normalized = `${nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
  await fs.writeFile(filePath, normalized, 'utf8');
  return true;
}

export async function removeManagedPath(targetPath: string, recursive = false): Promise<boolean> {
  try {
    await fs.rm(targetPath, {
      force: true,
      recursive
    });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
