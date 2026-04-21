import { Command } from 'commander';

import { runBootstrapCommand } from './commands/bootstrap.ts';
import { runDoctorCommand } from './commands/doctor.ts';
import { runDomainCurrentCommand, runDomainListCommand, runDomainShowCommand, runDomainUseCommand } from './commands/domains.ts';
import { runIntegrationFindCommand, runIntegrationInstallCommand, runIntegrationListCommand, runIntegrationShowCommand } from './commands/integrations.ts';
import { runMcpFindCommand, runMcpInstallCommand, runMcpListCommand, runMcpShowCommand } from './commands/mcp.ts';
import { runPlanCommand } from './commands/plan.ts';
import { runProfileCurrentCommand, runProfileListCommand, runProfileShowCommand, runProfileUseCommand } from './commands/profiles.ts';
import { runPruneCommand } from './commands/prune.ts';
import { runRegistryScaffoldCommand } from './commands/registry-scaffold.ts';
import { runRegistryValidateCommand } from './commands/registry.ts';
import { runStatusCommand } from './commands/status.ts';
import { runSkillsFindCommand, runSkillsInstallCommand, runSkillsListCommand, runSkillsRemoveCommand } from './commands/skills.ts';
import { runToolListCommand, runToolShowCommand } from './commands/tools.ts';
import { runUninstallCommand } from './commands/uninstall.ts';
import { runUpdateCommand } from './commands/update.ts';

const program = new Command();

program
  .name('powerhouse')
  .description('Bootstrap AI-native development environments.')
  .version('0.1.0');

program
  .command('bootstrap')
  .description('Resolve and apply a full install plan from profile + domain manifests.')
  .option('--profile <id>', 'profile manifest id')
  .option('--domain <id>', 'domain manifest id')
  .option('--integration-scope <scope>', 'integration scope: auto, global, project, or local', 'auto')
  .option('--mcp-scope <scope>', 'MCP scope: auto, global, project, or local', 'auto')
  .option('--yes', 'skip prompts and use defaults when needed', false)
  .option('--dry-run', 'print the resolved plan without mutating the machine', false)
  .action(runBootstrapCommand);

program.command('doctor').description('Check the current powerhouse environment and saved state.').action(runDoctorCommand);
program.command('status').description('Summarize the current powerhouse machine state and health.').action(runStatusCommand);
program
  .command('plan')
  .description('Resolve and inspect a bootstrap plan without running installs.')
  .option('--profile <id>', 'profile manifest id')
  .option('--domain <id>', 'domain manifest id')
  .option('--platform <os>', 'resolve for a target platform (darwin, linux, win32, or wsl)')
  .option('--integration-scope <scope>', 'integration scope: auto, global, project, or local', 'auto')
  .option('--mcp-scope <scope>', 'MCP scope: auto, global, project, or local', 'auto')
  .option('--json', 'print the resolved plan as JSON', false)
  .action(runPlanCommand);

const skills = program.command('skills').description('Manage agent skills via the skills CLI.');
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

const integration = program.command('integration').description('Discover and install curated agent integrations.');
integration
  .command('list')
  .description('List integrations for the active or specified profile.')
  .option('--agent <agent...>', 'filter to specific agents')
  .option('--profile <id>', 'profile manifest id')
  .action(runIntegrationListCommand);
integration
  .command('find')
  .description('Search integrations for the active or specified profile.')
  .argument('[query]', 'search query')
  .option('--agent <agent...>', 'filter to specific agents')
  .option('--profile <id>', 'profile manifest id')
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
  .description('List MCP servers for the active or specified profile.')
  .option('--agent <agent...>', 'filter to specific agents')
  .option('--profile <id>', 'profile manifest id')
  .action(runMcpListCommand);
mcp
  .command('find')
  .description('Search curated MCP servers.')
  .argument('[query]', 'search query')
  .option('--agent <agent...>', 'filter to specific agents')
  .option('--profile <id>', 'profile manifest id')
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

const profile = program.command('profile').description('Inspect curated powerhouse profiles.');
profile.command('list').description('List available profiles.').option('--platform <os>', 'filter by target platform').action(runProfileListCommand);
profile.command('current').description('Show the currently saved active profile.').action(runProfileCurrentCommand);
profile.command('show').description('Show one profile.').argument('<id>', 'profile id').option('--platform <os>', 'show compatibility for a target platform').action(runProfileShowCommand);
profile
  .command('use')
  .description('Apply a profile while preserving the current domain when possible.')
  .argument('<id>', 'profile id')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runProfileUseCommand);

const domain = program.command('domain').description('Inspect curated powerhouse domains.');
domain.command('list').description('List available domains.').action(runDomainListCommand);
domain.command('current').description('Show the currently saved active domain.').action(runDomainCurrentCommand);
domain.command('show').description('Show one domain.').argument('<id>', 'domain id').action(runDomainShowCommand);
domain
  .command('use')
  .description('Apply a domain while preserving the current profile when possible.')
  .argument('<id>', 'domain id')
  .option('--dry-run', 'resolve the change without mutating the machine', false)
  .option('--yes', 'skip confirmation prompts', false)
  .action(runDomainUseCommand);

const tool = program.command('tool').description('Inspect curated powerhouse tools.');
tool.command('list').description('List available tools.').option('--platform <os>', 'filter by target platform').action(runToolListCommand);
tool.command('show').description('Show one tool.').argument('<id>', 'tool id').option('--platform <os>', 'show compatibility for a target platform').action(runToolShowCommand);

const registry = program.command('registry').description('Validate and inspect the powerhouse registry.');
registry.command('validate').description('Validate cross-manifest registry consistency.').action(runRegistryValidateCommand);
registry
  .command('scaffold-domain')
  .description('Create a new domain manifest scaffold.')
  .argument('<id>', 'domain id')
  .option('--title <title>', 'optional display title')
  .option('--dry-run', 'print the scaffold without writing it', false)
  .action((id, options) => runRegistryScaffoldCommand('domain', id, options));
registry
  .command('scaffold-profile')
  .description('Create a new profile manifest scaffold.')
  .argument('<id>', 'profile id')
  .option('--title <title>', 'optional display title')
  .option('--dry-run', 'print the scaffold without writing it', false)
  .action((id, options) => runRegistryScaffoldCommand('profile', id, options));
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

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
