#!/usr/bin/env bun
/**
 * Generate Starlight documentation pages from registry manifests.
 *
 * Usage:
 *   bun scripts/generate-docs.ts           # skip existing files
 *   bun scripts/generate-docs.ts --force   # overwrite all
 */

import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const REGISTRY_DIR = path.resolve(import.meta.dir, '../registry');
const DOCS_DIR = path.resolve(import.meta.dir, '../apps/web/src/content/docs');
const FORCE = process.argv.includes('--force');

async function readJsonDir(dir: string): Promise<any[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const results: any[] = [];
  for (const entry of entries.filter((fileName) => fileName.endsWith('.json'))) {
    const raw = await readFile(path.join(dir, entry), 'utf8');
    results.push(JSON.parse(raw));
  }
  return results;
}

async function writeDoc(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  if (!FORCE) {
    try {
      await access(filePath);
      console.log(`  skip  ${path.relative(DOCS_DIR, filePath)}`);
      return;
    } catch {
      // file does not exist
    }
  }
  await writeFile(filePath, content, 'utf8');
  console.log(`  write ${path.relative(DOCS_DIR, filePath)}`);
}

function platformLabel(platform: string): string {
  return { darwin: 'macOS', linux: 'Linux', win32: 'Windows', wsl: 'WSL' }[platform] ?? platform;
}

function platformList(platforms: string[]): string {
  return platforms.map(platformLabel).join(', ');
}

function scopeList(scopes: string[]): string {
  return scopes.join(', ');
}

const tools: any[] = await readJsonDir(path.join(REGISTRY_DIR, 'tools'));
const harnesses: any[] = await readJsonDir(path.join(REGISTRY_DIR, 'harnesses'));
const domains: any[] = await readJsonDir(path.join(REGISTRY_DIR, 'domains'));
const integrations: any[] = await readJsonDir(path.join(REGISTRY_DIR, 'integrations'));
const mcpServers: any[] = await readJsonDir(path.join(REGISTRY_DIR, 'mcp'));

const toolById = new Map(tools.map((tool) => [tool.id, tool]));
const integrationById = new Map(integrations.map((integration) => [integration.id, integration]));
const mcpById = new Map(mcpServers.map((mcp) => [mcp.id, mcp]));
const harnessById = new Map(harnesses.map((harness) => [harness.id, harness]));

function resolveHarnessRequiredToolIds(harnessId: string): { toolId: string; source: string }[] {
  const seen = new Set<string>();
  const result: { toolId: string; source: string }[] = [];
  let current: string | undefined = harnessId;
  const chain: string[] = [];
  while (current) {
    chain.unshift(current);
    current = harnessById.get(current)?.extends;
  }
  for (const id of chain) {
    const harness = harnessById.get(id);
    if (!harness) continue;
    for (const toolId of harness.requiredToolIds ?? []) {
      if (seen.has(toolId)) {
        continue;
      }
      seen.add(toolId);
      result.push({ toolId, source: id === harnessId ? 'harness-specific' : `${id} harness` });
    }
  }
  return result;
}

const toolPurposeMap: Record<string, string> = {
  git: 'Version control foundation',
  curl: 'Network transfers and setup support',
  jq: 'JSON processor for APIs and configs',
  ripgrep: 'Fast recursive text search',
  fd: 'Fast file discovery',
  bat: 'Syntax-highlighted file previews',
  eza: 'Modern ls replacement with icons',
  fzf: 'Fuzzy finder for files and history',
  bun: 'JavaScript runtime and package manager',
  node: 'JavaScript/TypeScript runtime',
  python: 'Python interpreter',
  uv: 'Fast Python package manager',
  gh: 'GitHub CLI for repos and PRs',
  'claude-code': "Anthropic's AI coding agent (CLI)",
  'claude-app': "Anthropic's Claude desktop app (macOS only)",
  'codex-app': "OpenAI's Codex desktop app (macOS only)",
  codex: "OpenAI's Codex CLI coding agent",
  cursor: 'AI-native code editor',
  goose: "Block's open-source extensible AI agent",
  'gemini-cli': "Google's Gemini CLI agent",
  openclaw: 'OpenClaw personal AI assistant',
  opencode: 'Provider-agnostic open source coding agent',
  ollama: 'Local LLM runner',
  windsurf: "Codeium's AI-native code editor (Cascade)",
  zed: 'High-performance multiplayer code editor',
  cline: 'VS Code-based AI coding assistant'
};

console.log('\nGenerating harness pages…');
for (const harness of harnesses.filter((entry) => entry.id !== 'base')) {
  const resolvedTools = resolveHarnessRequiredToolIds(harness.id);
  const integrationList = (harness.integrationIds ?? []).map((id: string) => integrationById.get(id)).filter(Boolean);
  const mcpList = (harness.mcpServerIds ?? []).map((id: string) => mcpById.get(id)).filter(Boolean);

  const toolsTable =
    resolvedTools.length === 0
      ? '_No required tools._'
      : `| Tool | Purpose | Source |\n|---|---|---|\n` +
        resolvedTools
          .map(({ toolId, source }) => `| \`${toolId}\` | ${toolPurposeMap[toolId] ?? toolById.get(toolId)?.description ?? ''} | ${source} |`)
          .join('\n');

  const integrationsSection =
    integrationList.length === 0
      ? ''
      : `\n## Integrations\n\n| Integration | Description | Scopes |\n|---|---|---|\n` +
        integrationList
          .map((integration: any) => `| [\`${integration.id}\`](/integrations/${integration.id}) | ${integration.description} | ${scopeList(integration.supportedScopes)} |`)
          .join('\n') +
        '\n';

  const mcpSection =
    mcpList.length === 0
      ? ''
      : `\n## MCP Servers\n\n| Server | Description | Scopes |\n|---|---|---|\n` +
        mcpList
          .map((mcp: any) => `| [\`${mcp.id}\`](/mcp/${mcp.id}) | ${mcp.description} | ${scopeList(mcp.supportedScopes)} |`)
          .join('\n') +
        '\n';

  const content = `---
title: ${harness.title}
description: ${harness.description}
---

${harness.description}

## Required tools

${toolsTable}
${integrationsSection}${mcpSection}
## Platforms

Supported on **${platformList(harness.supportedPlatforms)}**.

## Default agents

Skills installed through active domains target **${(harness.defaultAgents ?? []).join(', ') || '—'}** by default.

## Using this harness

\`\`\`bash
powerhouse setup --harness ${harness.id}
\`\`\`

Or add it to an existing harness selection:

\`\`\`bash
powerhouse harness add ${harness.id}
\`\`\`
`;

  await writeDoc(path.join(DOCS_DIR, 'harnesses', `${harness.id}.md`), content);
}

console.log('\nGenerating domain pages…');
for (const domain of domains) {
  const recommendedTools: string[] = domain.recommendedToolIds ?? [];
  const skillPackages: any[] = domain.skillPackages ?? [];
  const integrationList = (domain.integrationIds ?? []).map((id: string) => integrationById.get(id)).filter(Boolean);
  const mcpList = (domain.mcpServerIds ?? []).map((id: string) => mcpById.get(id)).filter(Boolean);

  const toolsSection =
    recommendedTools.length === 0
      ? ''
      : `\n## Recommended optional tools\n\n| Tool | Description |\n|---|---|\n` +
        recommendedTools
          .map((id: string) => `| \`${id}\` | ${toolPurposeMap[id] ?? toolById.get(id)?.description ?? ''} |`)
          .join('\n') +
        '\n';

  const allSkills = skillPackages.flatMap((pkg: any) => (pkg.skills ?? []).map((skill: string) => ({ skill, source: pkg.source })));
  const skillsSection =
    allSkills.length === 0
      ? ''
      : `\n## Skills\n\n| Skill | Source |\n|---|---|\n` +
        allSkills.map(({ skill, source }: any) => `| \`${skill}\` | \`${source}\` |`).join('\n') +
        '\n';

  const integrationsSection =
    integrationList.length === 0
      ? ''
      : `\n## Integrations\n\n| Integration | Description |\n|---|---|\n` +
        integrationList
          .map((integration: any) => `| [\`${integration.id}\`](/integrations/${integration.id}) | ${integration.description} |`)
          .join('\n') +
        '\n';

  const mcpSection =
    mcpList.length === 0
      ? ''
      : `\n## MCP Servers\n\n| Server | Description |\n|---|---|\n` +
        mcpList
          .map((mcp: any) => `| [\`${mcp.id}\`](/mcp/${mcp.id}) | ${mcp.description} |`)
          .join('\n') +
        '\n';

  const content = `---
title: ${domain.title}
description: ${domain.description}
---

${domain.description}
${toolsSection}${skillsSection}${integrationsSection}${mcpSection}
Recommended domain tools are selected by default during setup. You can refine the optional tool layer later with \`powerhouse tool use\`, \`powerhouse tool add\`, or \`powerhouse tool remove\`.

## Using this domain

\`\`\`bash
powerhouse setup --domain ${domain.id}
\`\`\`

Or add it to an existing domain selection:

\`\`\`bash
powerhouse domain add ${domain.id}
\`\`\`
`;

  await writeDoc(path.join(DOCS_DIR, 'domains', `${domain.id}.md`), content);
}

console.log('\nGenerating integration pages…');
await mkdir(path.join(DOCS_DIR, 'integrations'), { recursive: true });
for (const integration of integrations) {
  const content = `---
title: ${integration.title}
description: ${integration.description}
---

${integration.description}

## Details

| | |
|---|---|
| **Target agent** | \`${integration.targetAgent}\` |
| **Install kind** | ${integration.installKind} |
| **Supported scopes** | ${scopeList(integration.supportedScopes)} |
| **Supported platforms** | ${platformList(integration.supportedPlatforms)} |
| **Source** | \`${integration.source}\` |
${integration.bundledMcpIds?.length ? `| **Bundled MCP servers** | ${integration.bundledMcpIds.map((id: string) => `[\`${id}\`](/mcp/${id})`).join(', ')} |` : ''}

## Installing

Install standalone:

\`\`\`bash
powerhouse integration install ${integration.id}
\`\`\`

Or it will be installed automatically during setup if it is included in your active harness selection.
`;

  await writeDoc(path.join(DOCS_DIR, 'integrations', `${integration.id}.md`), content);
}

console.log('\nGenerating MCP server pages…');
await mkdir(path.join(DOCS_DIR, 'mcp'), { recursive: true });
for (const mcp of mcpServers) {
  const content = `---
title: ${mcp.title}
description: ${mcp.description}
---

${mcp.description}

## Details

| | |
|---|---|
| **Server name** | \`${mcp.serverName}\` |
| **Target agents** | ${mcp.targetAgents.map((agent: string) => `\`${agent}\``).join(', ')} |
| **Server kind** | ${mcp.serverKind} |
| **Source** | \`${mcp.source}\` |
| **Supported scopes** | ${scopeList(mcp.supportedScopes)} |
| **Supported platforms** | ${platformList(mcp.supportedPlatforms)} |

## Installing

Install standalone:

\`\`\`bash
powerhouse mcp install ${mcp.id}
\`\`\`

Or it will be installed automatically during setup if it is included in your active harness selection.
`;

  await writeDoc(path.join(DOCS_DIR, 'mcp', `${mcp.id}.md`), content);
}

console.log('\nDone.\n');
