import fs from 'node:fs/promises';
import path from 'node:path';

export async function findWorkspaceRoot(startDir = process.cwd()): Promise<string> {
  let current = path.resolve(startDir);

  while (true) {
    const registryDir = path.join(current, 'registry');
    const packageJson = path.join(current, 'package.json');

    try {
      await fs.access(registryDir);
      await fs.access(packageJson);
      return current;
    } catch {
      // Continue walking up.
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Unable to locate the powerhouse workspace root.');
    }
    current = parent;
  }
}

