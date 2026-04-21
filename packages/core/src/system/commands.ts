import { execa } from 'execa';

export async function commandExists(command: string): Promise<boolean> {
  try {
    await execa('bash', ['-lc', `command -v ${shellEscape(command)}`], {
      stdout: 'ignore',
      stderr: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}

export async function resolveCommandPath(command: string): Promise<string | null> {
  try {
    const result = await execa('bash', ['-lc', `command -v ${shellEscape(command)}`], {
      stdout: 'pipe',
      stderr: 'ignore'
    });
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function shellCommandSucceeds(command: string): Promise<boolean> {
  try {
    await execa('bash', ['-lc', command], {
      stdout: 'ignore',
      stderr: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}

export async function resolveSkillsRunner(): Promise<'npx' | 'bunx' | null> {
  if (await commandExists('npx')) {
    return 'npx';
  }
  if (await commandExists('bunx')) {
    return 'bunx';
  }
  return null;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

