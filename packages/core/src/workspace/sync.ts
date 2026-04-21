import fs from 'node:fs/promises';
import path from 'node:path';

import { execa } from 'execa';

export interface WorkspaceSyncResult {
  status: 'updated' | 'skipped';
  detail: string;
}

export async function syncWorkspaceWithGit(rootDir: string): Promise<WorkspaceSyncResult> {
  const gitDir = path.join(rootDir, '.git');
  try {
    await fs.access(gitDir);
  } catch {
    return {
      status: 'skipped',
      detail: 'Workspace is not a git checkout; skipping self-update.'
    };
  }

  const status = await execa('git', ['status', '--porcelain'], {
    cwd: rootDir,
    stdout: 'pipe',
    stderr: 'ignore'
  });

  if (status.stdout.trim().length > 0) {
    return {
      status: 'skipped',
      detail: 'Workspace has local changes; skipping git pull.'
    };
  }

  await execa('git', ['pull', '--ff-only'], {
    cwd: rootDir,
    stdout: 'inherit',
    stderr: 'inherit'
  });

  return {
    status: 'updated',
    detail: 'Workspace synced with git.'
  };
}

export async function syncWorkspaceDependencies(rootDir: string): Promise<void> {
  await execa('bun', ['install'], {
    cwd: rootDir,
    stdout: 'inherit',
    stderr: 'inherit'
  });
}

