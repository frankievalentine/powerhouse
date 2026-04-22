import { Command } from 'commander';

import { runSetupCommand } from './commands/setup.ts';
import { runDoctorCommand } from './commands/doctor.ts';
import {
  runDomainAddCommand,
  runDomainCurrentCommand,
  runDomainListCommand,
  runDomainRemoveCommand,
  runDomainShowCommand,
  runDomainUseCommand
} from './commands/domains.ts';
import {
  runHarnessAddCommand,
  runHarnessCurrentCommand,
  runHarnessListCommand,
  runHarnessRemoveCommand,
  runHarnessShowCommand,
  runHarnessUseCommand
} from './commands/harnesses.ts';
import { runIntegrationFindCommand, runIntegrationInstallCommand, runIntegrationListCommand, runIntegrationShowCommand } from './commands/integrations.ts';
import { runMcpFindCommand, runMcpInstallCommand, runMcpListCommand, runMcpShowCommand } from './commands/mcp.ts';
import { runPlanCommand } from './commands/plan.ts';
import { runPruneCommand } from './commands/prune.ts';
import { runRegistryScaffoldCommand } from './commands/registry-scaffold.ts';
import { runRegistryValidateCommand } from './commands/registry.ts';
import { appendStringOption } from './commands/selection.ts';
import { runStatusCommand } from './commands/status.ts';
import { runSkillsFindCommand, runSkillsInstallCommand, runSkillsListCommand, runSkillsRemoveCommand } from './commands/skills.ts';
import {
  runToolAddCommand,
  runToolCurrentCommand,
  runToolListCommand,
  runToolRemoveCommand,
  runToolShowCommand,
  runToolUseCommand
} from './commands/tools.ts';
import { runUninstallCommand } from './commands/uninstall.ts';
import { runUpdateCommand } from './commands/update.ts';

const program = new Command();

if (process.argv[2] === 'bootstrap') {
  console.warn('warning: `powerhouse bootstrap` is deprecated. Use `powerhouse setup`.');
  process.argv[2] = 'setup';
}

function addSetupOptions(command: Command): Command {
  return command
    .option('--harness <id>', 'harness manifest id (repeatable)', appendStringOption, [])
    .option('--domain <id>', 'domain manifest id (repeatable)', appendStringOption, [])
    .option('--tool <id>', 'optional tool id (repeatable)', appendStringOption, [])
    .option('--integration-scope <scope>', 'integration scope: auto, global, project, or local', 'auto')
    .option('--mcp-scope <scope>', 'MCP scope: auto, global, project, or local', 'auto')
    .option('--yes', 'skip prompts and use defaults when needed', false)
    .option('--dry-run', 'print the resolved plan without mutating the machine', false)
    .action(runSetupCommand);
}

program
  .name('powerhouse')
  .description('Set up a curated AI coding environment.')
  .version('0.1.0');

addSetupOptions(program.command('setup').description('Install a harness + domain setup with explicit tools.'));

program.command('doctor').description('Check setup health and saved state.').action(runDoctorCommand);
program.command('status').description('Show setup state, paths, and health.').action(runStatusCommand);
program
  .command('plan')
  .description('Preview a setup plan without changing anything.')
  .option('--harness <id>', 'harness manifest id (repeatable)', appendStringOption, [])
  .option('--domain <id>', 'domain manifest id (repeatable)', appendStringOption, [])
  .option('--tool <id>', 'optional tool id (repeatable)', appendStringOption, [])
  .option('--platform <os>', 'resolve for a target platform (darwin, linux, win32, or wsl)')
  .option('--integration-scope <scope>', 'integration scope: auto, global, project, or local', 'auto')
  .option('--mcp-scope <scope>', 'MCP scope: auto, global, project, or local', 'auto')
  .option('--json', 'print the resolved plan as JSON', false)
  .action(runPlanCommand);

const skills = program.command('skills').description('Manage skills with the upstream skills CLI.');
skills
  .command('list')
  .description('List installed skills using the upstream skills CLI.')
  .option('--global', 'list only global skills', false)
  .option('--agent <agent...>', 'filter to specific agents')
  .action(runSkillsListCommand);
skills
  .command('install')
  .description('Install a skill package using the upstream skills CLI.')
  .argument('<source>', 'repository, URL, or local path understood by skills add')
  .option('--skill <skill...>', 'specific skill names to install')
  .option('--agent <agent...>', 'target specific agents')
  .option('--project', 'install into the current project instead of globally', false)
  .action(runSkillsInstallCommand);
skills
  .command('find')
  .description('Search available skills using the upstream skills CLI.')
  .argument('[query]', 'optional search query')
  .action(runSkillsFindCommand);
skills
  .command('remove')
  .description('Remove installed skills using the upstream skills CLI.')
  .argument('[skills...]', 'skill names to remove; omit for interactive mode')
  .option('--agent <agent...>', 'target specific agents')
  .option('--global', 'remove from global scope', false)
  .option('--all', 'remove all installed skills', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runSkillsRemoveCommand);

const integration = program.command('integration').description('Discover and install curated integrations.');
integration
  .command('list')
  .description('List integrations for the active or specified harness.')
  .option('--agent <agent...>', 'filter to specific agents')
  .option('--harness <id>', 'harness manifest id')
  .action(runIntegrationListCommand);
integration
  .command('find')
  .description('Search integrations for the active or specified harness.')
  .argument('[query]', 'search query')
  .option('--agent <agent...>', 'filter to specific agents')
  .option('--harness <id>', 'harness manifest id')
  .action(runIntegrationFindCommand);
integration
  .command('show')
  .description('Show one integration manifest.')
  .argument('<id>', 'integration id')
  .action(runIntegrationShowCommand);
integration
  .command('install')
  .description('Install one curated integration.')
  .argument('<id>', 'integration id')
  .option('--scope <scope>', 'install scope: auto, global, project, or local', 'auto')
  .option('--dry-run', 'preview the install without changing config', false)
  .action(runIntegrationInstallCommand);

const mcp = program.command('mcp').description('Discover and install curated MCP servers.');
mcp
  .command('list')
  .description('List MCP servers for the active or specified harness.')
  .option('--agent <agent...>', 'filter to specific agents')
  .option('--harness <id>', 'harness manifest id')
  .action(runMcpListCommand);
mcp
  .command('find')
  .description('Search curated MCP servers.')
  .argument('[query]', 'search query')
  .option('--agent <agent...>', 'filter to specific agents')
  .option('--harness <id>', 'harness manifest id')
  .action(runMcpFindCommand);
mcp
  .command('show')
  .description('Show one MCP server manifest.')
  .argument('<id>', 'mcp server id')
  .action(runMcpShowCommand);
mcp
  .command('install')
  .description('Install one curated MCP server.')
  .argument('<id>', 'mcp server id')
  .option('--scope <scope>', 'install scope: auto, global, project, or local', 'auto')
  .option('--dry-run', 'preview the install without changing config', false)
  .action(runMcpInstallCommand);

const harness = program.command('harness').description('Inspect curated harnesses.');
harness.command('list').description('List available harnesses.').option('--platform <os>', 'filter by target platform').action(runHarnessListCommand);
harness.command('current').description('Show the currently saved active harness selection.').action(runHarnessCurrentCommand);
harness.command('show').description('Show one harness.').argument('<id>', 'harness id').option('--platform <os>', 'show compatibility for a target platform').action(runHarnessShowCommand);
harness
  .command('use')
  .description('Replace the active harness set while preserving the current domain selection.')
  .argument('<ids...>', 'harness ids')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runHarnessUseCommand);
harness
  .command('add')
  .description('Add one or more harnesses to the active selection.')
  .argument('<ids...>', 'harness ids')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runHarnessAddCommand);
harness
  .command('remove')
  .description('Remove one or more harnesses from the active selection.')
  .argument('<ids...>', 'harness ids')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runHarnessRemoveCommand);

const domain = program.command('domain').description('Inspect curated domains.');
domain.command('list').description('List available domains.').action(runDomainListCommand);
domain.command('current').description('Show the currently saved active domain selection.').action(runDomainCurrentCommand);
domain.command('show').description('Show one domain.').argument('<id>', 'domain id').action(runDomainShowCommand);
domain
  .command('use')
  .description('Replace the active domain set while preserving the current harness selection.')
  .argument('<ids...>', 'domain ids')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runDomainUseCommand);
domain
  .command('add')
  .description('Add one or more domains to the active selection.')
  .argument('<ids...>', 'domain ids')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runDomainAddCommand);
domain
  .command('remove')
  .description('Remove one or more domains from the active selection.')
  .argument('<ids...>', 'domain ids')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runDomainRemoveCommand);

const tool = program.command('tool').description('Inspect and manage curated tools.');
tool.command('list').description('List available tools.').option('--platform <os>', 'filter by target platform').action(runToolListCommand);
tool.command('current').description('Show the current required and optional tool selection.').action(runToolCurrentCommand);
tool.command('show').description('Show one tool.').argument('<id>', 'tool id').option('--platform <os>', 'show compatibility for a target platform').action(runToolShowCommand);
tool
  .command('use')
  .description('Replace the selected optional tool set.')
  .argument('[ids...]', 'optional tool ids')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runToolUseCommand);
tool
  .command('add')
  .description('Add one or more optional tools to the active selection.')
  .argument('<ids...>', 'optional tool ids')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runToolAddCommand);
tool
  .command('remove')
  .description('Remove one or more optional tools from the active selection.')
  .argument('<ids...>', 'optional tool ids')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runToolRemoveCommand);

const registry = program.command('registry').description('Validate and inspect the registry.');
registry.command('validate').description('Validate cross-manifest registry consistency.').action(runRegistryValidateCommand);
registry
  .command('scaffold-domain')
  .description('Create a new domain manifest scaffold.')
  .argument('<id>', 'domain id')
  .option('--title <title>', 'optional display title')
  .option('--dry-run', 'print the scaffold without writing it', false)
  .action((id, options) => runRegistryScaffoldCommand('domain', id, options));
registry
  .command('scaffold-harness')
  .description('Create a new harness manifest scaffold.')
  .argument('<id>', 'harness id')
  .option('--title <title>', 'optional display title')
  .option('--dry-run', 'print the scaffold without writing it', false)
  .action((id, options) => runRegistryScaffoldCommand('harness', id, options));
registry
  .command('scaffold-tool')
  .description('Create a new tool manifest scaffold.')
  .argument('<id>', 'tool id')
  .option('--title <title>', 'optional display title')
  .option('--dry-run', 'print the scaffold without writing it', false)
  .action((id, options) => runRegistryScaffoldCommand('tool', id, options));
registry
  .command('scaffold-integration')
  .description('Create a new integration manifest scaffold.')
  .argument('<id>', 'integration id')
  .option('--title <title>', 'optional display title')
  .option('--dry-run', 'print the scaffold without writing it', false)
  .action((id, options) => runRegistryScaffoldCommand('integration', id, options));
registry
  .command('scaffold-mcp')
  .description('Create a new MCP server manifest scaffold.')
  .argument('<id>', 'mcp server id')
  .option('--title <title>', 'optional display title')
  .option('--dry-run', 'print the scaffold without writing it', false)
  .action((id, options) => runRegistryScaffoldCommand('mcp', id, options));

program.command('update').description('Re-sync the active powerhouse selection and update installed skills.').action(runUpdateCommand);
program
  .command('prune')
  .description('Remove tracked managed assets that are no longer part of the active plan.')
  .option('--yes', 'skip confirmation prompts', false)
  .option('--keep-tools', 'leave tracked tools installed', false)
  .option('--keep-configs', 'leave tracked integration and MCP config changes in place', false)
  .action(runPruneCommand);
program
  .command('uninstall')
  .description('Remove powerhouse and everything it can prove it installed or changed.')
  .option('--yes', 'skip confirmation prompts', false)
  .option('--keep-tools', 'leave tracked tools installed', false)
  .option('--keep-configs', 'leave tracked integration and MCP config changes in place', false)
  .option('--purge-cache', 'remove the powerhouse cache directory', false)
  .option('--force-drift', 'restore tracked config snapshots even when the current file has drifted', false)
  .action(runUninstallCommand);

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
