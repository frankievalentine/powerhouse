import { loadRegistry, validateRegistry } from '@powerhouse/core';

export async function runRegistryValidateCommand(): Promise<void> {
  const registry = await loadRegistry();
  const result = validateRegistry(registry);

  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log('Registry validation passed.');
    return;
  }

  if (result.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.log('Errors:');
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

