import { scaffoldRegistryManifest, type RegistryScaffoldKind } from '@powerhouse/core';

export interface RegistryScaffoldCommandOptions {
  dryRun?: boolean;
  title?: string;
}

export async function runRegistryScaffoldCommand(
  kind: RegistryScaffoldKind,
  id: string,
  options: RegistryScaffoldCommandOptions
): Promise<void> {
  const result = await scaffoldRegistryManifest(kind, id, {
    dryRun: options.dryRun,
    title: options.title
  });

  if (result.written) {
    console.log(`Created ${kind} manifest at ${result.path}`);
    return;
  }

  console.log(`Would create ${kind} manifest at ${result.path}`);
  console.log('');
  process.stdout.write(result.content);
}

