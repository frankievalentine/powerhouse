import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { execa } from 'execa';

import type { DetectedPlatform, PlatformTarget } from '../platform/detect.ts';
import type {
  CatalogInstall,
  IntegrationManifest,
  JsonConfigOperation,
  McpManifest,
  NormalizedScope,
  TomlConfigOperation
} from '../registry/schema.ts';
import type { RegistryData } from '../registry/load.ts';
import type { ConfigFileSnapshot, IntegrationLedgerEntry, McpLedgerEntry } from '../state/ledger.ts';
import type { InstalledCatalogState } from '../state/paths.ts';

export type CatalogScopeOption = NormalizedScope | 'auto';
export type CatalogInstallStatus = InstalledCatalogState['status'];

export interface CatalogInstallResult extends InstalledCatalogState {
  title: string;
  detail: string;
  nativeScope?: string;
  removable: boolean;
  restartRequired: boolean;
  installKind: CatalogInstall['kind'];
  fileChanges: ConfigFileSnapshot[];
}

export interface CatalogInstallOptions {
  scope?: CatalogScopeOption;
  dryRun?: boolean;
  onLog?: (message: string) => void;
  projectDir?: string;
  runCommandImpl?: (command: string, args: string[], cwd: string, env?: Record<string, string>) => Promise<void>;
}

export interface CatalogRemovalOptions {
  dryRun?: boolean;
  forceDrift?: boolean;
  onLog?: (message: string) => void;
}

export interface CatalogRemovalResult {
  id: string;
  status: 'removed' | 'planned' | 'skipped';
  detail: string;
}

export interface CatalogQueryOptions {
  agents?: string[];
  platform?: PlatformTarget;
  query?: string;
}

interface CatalogInstallContext {
  dryRun: boolean;
  onLog?: (message: string) => void;
  platform: DetectedPlatform & { os: PlatformTarget };
  projectDir: string;
  runCommandImpl?: (command: string, args: string[], cwd: string, env?: Record<string, string>) => Promise<void>;
}

interface TemplateContext {
  id: string;
  source: string;
  scope: NormalizedScope;
  nativeScope: string;
  projectDir: string;
  homeDir: string;
  serverName?: string;
}

export function findIntegrations(registry: RegistryData, options: CatalogQueryOptions = {}): IntegrationManifest[] {
  return registry.integrations
    .filter((integration) => isCatalogItemMatch(integration.supportedPlatforms, [integration.targetAgent], catalogSearchValues(integration), options))
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function findMcpServers(registry: RegistryData, options: CatalogQueryOptions = {}): McpManifest[] {
  return registry.mcpServers
    .filter((server) => isCatalogItemMatch(server.supportedPlatforms, server.targetAgents, catalogSearchValues(server), options))
    .sort((left, right) => left.title.localeCompare(right.title));
}

export async function installIntegrations(
  integrations: IntegrationManifest[],
  platform: DetectedPlatform & { os: PlatformTarget },
  options: CatalogInstallOptions = {}
): Promise<CatalogInstallResult[]> {
  return installCatalogItems(integrations, platform, options);
}

export async function installMcpServers(
  mcpServers: McpManifest[],
  platform: DetectedPlatform & { os: PlatformTarget },
  options: CatalogInstallOptions = {}
): Promise<CatalogInstallResult[]> {
  return installCatalogItems(mcpServers, platform, options);
}

export async function removeTrackedCatalogEntry(
  entry: IntegrationLedgerEntry | McpLedgerEntry,
  options: CatalogRemovalOptions = {}
): Promise<CatalogRemovalResult> {
  if (!entry.removable) {
    return {
      id: entry.id,
      status: 'skipped',
      detail: `Entry "${entry.id}" is not safely removable.`
    };
  }

  if (options.dryRun) {
    return {
      id: entry.id,
      status: 'planned',
      detail: `Would remove tracked changes for "${entry.id}".`
    };
  }

  const driftedFiles: string[] = [];
  for (const change of entry.fileChanges) {
    if (await isSnapshotDrifted(change)) {
      if (!options.forceDrift) {
        driftedFiles.push(change.filePath);
        continue;
      }
    }

    await restoreFileSnapshot(change);
  }

  if (driftedFiles.length > 0) {
    return {
      id: entry.id,
      status: 'skipped',
      detail: `Drift detected in ${driftedFiles.join(', ')}. Re-run with --force-drift to restore the tracked snapshot.`
    };
  }

  options.onLog?.(`catalog-remove ${entry.id}`);
  return {
    id: entry.id,
    status: 'removed',
    detail: `Removed tracked changes for "${entry.id}".`
  };
}

export async function detectCatalogDrift(entry: IntegrationLedgerEntry | McpLedgerEntry): Promise<string[]> {
  const drifted: string[] = [];
  for (const change of entry.fileChanges) {
    if (await isSnapshotDrifted(change)) {
      drifted.push(change.filePath);
    }
  }
  return drifted;
}

function isCatalogItemMatch(
  supportedPlatforms: PlatformTarget[],
  targetAgents: string[],
  searchValues: string[],
  options: CatalogQueryOptions
): boolean {
  if (options.platform && !supportedPlatforms.includes(options.platform)) {
    return false;
  }

  if (options.agents && options.agents.length > 0 && !options.agents.some((agent) => targetAgents.includes(agent))) {
    return false;
  }

  if (!options.query) {
    return true;
  }

  const needle = options.query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }

  return searchValues.some((value) => value.toLowerCase().includes(needle));
}

function catalogSearchValues(item: IntegrationManifest | McpManifest): string[] {
  if ('targetAgent' in item) {
    return [item.id, item.title, item.description, item.targetAgent, item.source, ...item.tags];
  }

  return [item.id, item.title, item.description, item.serverName, item.source, ...item.targetAgents, ...item.tags];
}

async function installCatalogItems(
  items: Array<IntegrationManifest | McpManifest>,
  platform: DetectedPlatform & { os: PlatformTarget },
  options: CatalogInstallOptions
): Promise<CatalogInstallResult[]> {
  const context: CatalogInstallContext = {
    dryRun: options.dryRun ?? false,
    onLog: options.onLog,
    platform,
    projectDir: path.resolve(options.projectDir ?? process.cwd()),
    runCommandImpl: options.runCommandImpl
  };

  const results: CatalogInstallResult[] = [];
  for (const item of items) {
    const resolvedScope = resolveCatalogScope(item.supportedScopes, options.scope ?? 'auto');
    if (!resolvedScope) {
      results.push({
        id: item.id,
        title: item.title,
        scope: options.scope && options.scope !== 'auto' ? options.scope : 'global',
        status: 'unsupported_scope',
        detail: `Unsupported scope. Available: ${item.supportedScopes.join(', ')}`,
        removable: false,
        restartRequired: false,
        installKind: item.install.kind,
        fileChanges: []
      });
      continue;
    }

    const result = await installCatalogItem(item, resolvedScope, context);
    results.push(result);
  }

  return results;
}

function resolveCatalogScope(supportedScopes: NormalizedScope[], requested: CatalogScopeOption): NormalizedScope | null {
  if (requested !== 'auto') {
    return supportedScopes.includes(requested) ? requested : null;
  }

  for (const candidate of ['global', 'project', 'local'] as const) {
    if (supportedScopes.includes(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function installCatalogItem(
  item: IntegrationManifest | McpManifest,
  scope: NormalizedScope,
  context: CatalogInstallContext
): Promise<CatalogInstallResult> {
  const nativeScope = renderNativeScope(item.install, scope);
  const templateContext: TemplateContext = {
    id: item.id,
    source: item.source,
    scope,
    nativeScope,
    projectDir: context.projectDir,
    homeDir: context.platform.homeDir,
    serverName: 'serverName' in item ? item.serverName : undefined
  };

  if (item.install.kind === 'manual') {
    const instructions = item.install.instructions.map((instruction) => renderTemplateString(instruction, templateContext));
    context.onLog?.(`manual ${item.id}`);
    return {
      id: item.id,
      title: item.title,
      scope,
      nativeScope,
      status: 'manual_step_required',
      detail: instructions.join(' '),
      removable: false,
      restartRequired: item.install.restartRequired,
      installKind: item.install.kind,
      fileChanges: []
    };
  }

  if (context.dryRun) {
    context.onLog?.(`plan ${item.id}`);
    return {
      id: item.id,
      title: item.title,
      scope,
      nativeScope,
      status: 'planned',
      detail: describeDryRun(item, scope, nativeScope, templateContext),
      removable: item.install.kind === 'json-config' || item.install.kind === 'toml-config',
      restartRequired: item.install.restartRequired,
      installKind: item.install.kind,
      fileChanges: []
    };
  }

  context.onLog?.(`catalog ${item.id}`);
  let fileChanges: ConfigFileSnapshot[] = [];

  if (item.install.kind === 'native-cli') {
    await runNativeCliInstall(item.install, templateContext, context);
  } else if (item.install.kind === 'json-config') {
    fileChanges = [await runJsonConfigInstall(item.install, scope, templateContext)];
  } else if (item.install.kind === 'toml-config') {
    fileChanges = [await runTomlConfigInstall(item.install, scope, templateContext)];
  }

  return {
    id: item.id,
    title: item.title,
    scope,
    nativeScope,
    status: item.install.restartRequired ? 'restart_required' : 'configured',
    detail: item.install.restartRequired ? 'Configured. Restart required.' : 'Configured.',
    removable: fileChanges.some((change) => change.contentChanged),
    restartRequired: item.install.restartRequired,
    installKind: item.install.kind,
    fileChanges
  };
}

function describeDryRun(
  item: IntegrationManifest | McpManifest,
  scope: NormalizedScope,
  nativeScope: string,
  templateContext: TemplateContext
): string {
  if (item.install.kind === 'native-cli') {
    const args = item.install.args.map((value) => renderTemplateString(value, templateContext)).join(' ');
    return `Would run ${item.install.command} ${args}`.trim();
  }

  if (item.install.kind === 'json-config') {
    const filePath = resolveScopePath(item.install.scopePaths, scope, templateContext);
    return `Would update ${filePath}`;
  }

  if (item.install.kind === 'toml-config') {
    const filePath = resolveScopePath(item.install.scopePaths, scope, templateContext);
    return `Would update ${filePath}`;
  }

  return `Would configure ${item.id} for ${nativeScope}`;
}

function renderNativeScope(install: CatalogInstall, scope: NormalizedScope): string {
  if (install.kind !== 'native-cli') {
    return scope;
  }

  return install.scopeMap[scope] ?? scope;
}

async function runNativeCliInstall(
  install: Extract<CatalogInstall, { kind: 'native-cli' }>,
  templateContext: TemplateContext,
  context: CatalogInstallContext
): Promise<void> {
  const args = install.args.map((value) => renderTemplateString(value, templateContext));
  const env = Object.fromEntries(
    Object.entries(install.env).map(([key, value]) => [key, renderTemplateString(value, templateContext)])
  );
  const cwd = install.cwd === 'home' ? templateContext.homeDir : templateContext.projectDir;

  if (context.runCommandImpl) {
    await context.runCommandImpl(install.command, args, cwd, Object.keys(env).length > 0 ? env : undefined);
    return;
  }

  await execa(install.command, args, {
    cwd,
    env: Object.keys(env).length > 0 ? env : undefined,
    stdout: 'ignore',
    stderr: 'pipe'
  });
}

async function runJsonConfigInstall(
  install: Extract<CatalogInstall, { kind: 'json-config' }>,
  scope: NormalizedScope,
  templateContext: TemplateContext
): Promise<ConfigFileSnapshot> {
  const filePath = resolveScopePath(install.scopePaths, scope, templateContext);
  const existedBefore = await fileExists(filePath);
  const beforeContent = existedBefore ? await readTextFile(filePath) : '';
  const config = await loadJsonConfig(filePath);

  for (const operation of install.operations) {
    applyJsonOperation(config, operation, templateContext);
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const afterContent = JSON.stringify(config, null, 2) + '\n';
  await fs.writeFile(filePath, afterContent, 'utf8');
  return buildFileSnapshot(filePath, existedBefore, existedBefore ? beforeContent : null, afterContent);
}

async function runTomlConfigInstall(
  install: Extract<CatalogInstall, { kind: 'toml-config' }>,
  scope: NormalizedScope,
  templateContext: TemplateContext
): Promise<ConfigFileSnapshot> {
  const filePath = resolveScopePath(install.scopePaths, scope, templateContext);
  const existedBefore = await fileExists(filePath);
  const beforeContent = existedBefore ? await readTextFile(filePath) : '';
  let content = beforeContent;

  for (const operation of install.operations) {
    content = applyTomlOperation(content, operation, templateContext);
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const afterContent = normalizeToml(content);
  await fs.writeFile(filePath, afterContent, 'utf8');
  return buildFileSnapshot(filePath, existedBefore, existedBefore ? beforeContent : null, afterContent);
}

function applyJsonOperation(target: Record<string, unknown>, operation: JsonConfigOperation, templateContext: TemplateContext): void {
  if (operation.op === 'ensure-array-contains') {
    const parent = getOrCreateObject(target, operation.path.slice(0, -1));
    const key = operation.path[operation.path.length - 1];
    if (!key) {
      throw new Error('JSON array path must not be empty.');
    }
    const existing = parent[key];
    const list = Array.isArray(existing) ? existing : [];
    const value = renderTemplateString(operation.value, templateContext);
    if (!list.includes(value)) {
      list.push(value);
    }
    parent[key] = list;
    return;
  }

  const container = getOrCreateObject(target, operation.path);
  const key = renderTemplateString(operation.key, templateContext);

  if (operation.op === 'set-object-entry') {
    container[key] = renderJsonValue(operation.value, templateContext);
    return;
  }

  const existing = container[key];
  const nextValue = renderJsonValue(operation.value, templateContext);
  container[key] = {
    ...(isPlainObject(existing) ? existing : {}),
    ...(isPlainObject(nextValue) ? nextValue : {})
  };
}

function applyTomlOperation(content: string, operation: TomlConfigOperation, templateContext: TemplateContext): string {
  if (operation.op === 'ensure-bool') {
    const key = renderTemplateString(operation.key, templateContext);
    return upsertTomlBool(content, operation.section ? renderTemplateString(operation.section, templateContext) : undefined, key, operation.value);
  }

  const header = renderTemplateString(operation.header, templateContext);
  if (hasTomlSection(content, header)) {
    return content;
  }

  const lines = operation.lines.map((line) => renderTemplateString(line, templateContext));
  const block = [`[${header}]`, ...lines].join('\n');
  return appendTomlBlock(content, block);
}

async function loadJsonConfig(filePath: string): Promise<Record<string, unknown>> {
  const content = await readTextFile(filePath);
  if (content.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return JSON.parse(stripJsonComments(content)) as Record<string, unknown>;
  }
}

async function readTextFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function resolveScopePath(
  scopePaths: Partial<Record<NormalizedScope, string>>,
  scope: NormalizedScope,
  templateContext: TemplateContext
): string {
  const rawPath = scopePaths[scope];
  if (!rawPath) {
    throw new Error(`No path configured for ${scope} scope.`);
  }

  const rendered = renderTemplateString(rawPath, templateContext);
  if (rendered.startsWith('~/')) {
    return path.join(templateContext.homeDir, rendered.slice(2));
  }
  if (path.isAbsolute(rendered)) {
    return rendered;
  }
  return path.join(templateContext.projectDir, rendered);
}

function getOrCreateObject(root: Record<string, unknown>, pathParts: string[]): Record<string, unknown> {
  let current: Record<string, unknown> = root;
  for (const part of pathParts) {
    if (!isPlainObject(current[part])) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  return current;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function renderJsonValue(value: unknown, templateContext: TemplateContext): unknown {
  if (typeof value === 'string') {
    return renderTemplateString(value, templateContext);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => renderJsonValue(entry, templateContext));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, renderJsonValue(entry, templateContext)]));
  }
  return value;
}

function renderTemplateString(value: string, templateContext: TemplateContext): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    if (key === 'serverName') {
      return templateContext.serverName ?? '';
    }
    if (key === 'nativeScope') {
      return templateContext.nativeScope;
    }
    if (key === 'projectDir') {
      return templateContext.projectDir;
    }
    if (key === 'homeDir') {
      return templateContext.homeDir;
    }
    if (key === 'scope') {
      return templateContext.scope;
    }
    if (key === 'source') {
      return templateContext.source;
    }
    if (key === 'id') {
      return templateContext.id;
    }
    return '';
  });
}

function stripJsonComments(input: string): string {
  let result = '';
  let inString = false;
  let escape = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"' && !inString) {
      inString = true;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += char;
  }

  return result;
}

function upsertTomlBool(content: string, section: string | undefined, key: string, value: boolean): string {
  const line = `${key} = ${value ? 'true' : 'false'}`;
  if (!section) {
    const matcher = new RegExp(`^${escapeRegExp(key)}\\s*=\\s*(true|false)\\s*$`, 'm');
    if (matcher.test(content)) {
      return content.replace(matcher, line);
    }
    return appendTomlBlock(content, line);
  }

  const headerLine = `[${section}]`;
  const match = sectionBounds(content, headerLine);
  if (!match) {
    return appendTomlBlock(content, `${headerLine}\n${line}`);
  }

  const block = content.slice(match.start, match.end);
  const matcher = new RegExp(`^${escapeRegExp(key)}\\s*=\\s*(true|false)\\s*$`, 'm');
  const updatedBlock = matcher.test(block) ? block.replace(matcher, line) : `${block.trimEnd()}\n${line}\n`;
  return `${content.slice(0, match.start)}${updatedBlock}${content.slice(match.end)}`;
}

function hasTomlSection(content: string, header: string): boolean {
  const matcher = new RegExp(`^\\[${escapeRegExp(header)}\\]\\s*$`, 'm');
  return matcher.test(content);
}

function sectionBounds(content: string, headerLine: string): { start: number; end: number } | null {
  const matcher = new RegExp(`^${escapeRegExp(headerLine)}\\s*$`, 'm');
  const match = matcher.exec(content);
  if (!match || match.index === undefined) {
    return null;
  }

  const start = match.index;
  const tail = content.slice(start + headerLine.length);
  const nextSectionMatch = /\n\[[^\]]+\]/.exec(tail);
  const end = nextSectionMatch?.index ? start + headerLine.length + nextSectionMatch.index + 1 : content.length;
  return { start, end };
}

function appendTomlBlock(content: string, block: string): string {
  const trimmed = content.trimEnd();
  if (trimmed.length === 0) {
    return `${block}\n`;
  }
  return `${trimmed}\n\n${block}\n`;
}

function normalizeToml(content: string): string {
  return `${content.trim()}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFileSnapshot(
  filePath: string,
  existedBefore: boolean,
  beforeContent: string | null,
  afterContent: string
): ConfigFileSnapshot {
  return {
    filePath,
    existedBefore,
    beforeContent,
    afterFingerprint: fingerprintContent(afterContent),
    contentChanged: normalizeContent(beforeContent) !== normalizeContent(afterContent)
  };
}

async function restoreFileSnapshot(snapshot: ConfigFileSnapshot): Promise<void> {
  if (!snapshot.contentChanged) {
    return;
  }

  if (snapshot.existedBefore) {
    await fs.mkdir(path.dirname(snapshot.filePath), { recursive: true });
    await fs.writeFile(snapshot.filePath, snapshot.beforeContent ?? '', 'utf8');
    return;
  }

  await fs.rm(snapshot.filePath, { force: true });
}

async function isSnapshotDrifted(snapshot: ConfigFileSnapshot): Promise<boolean> {
  if (!snapshot.contentChanged) {
    return false;
  }

  const exists = await fileExists(snapshot.filePath);
  if (!exists) {
    return snapshot.afterFingerprint !== null;
  }

  return fingerprintContent(await readTextFile(snapshot.filePath)) !== snapshot.afterFingerprint;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function fingerprintContent(content: string | null): string | null {
  if (content === null) {
    return null;
  }

  return crypto.createHash('sha256').update(normalizeContent(content)).digest('hex');
}

function normalizeContent(content: string | null): string {
  return (content ?? '').replace(/\r\n/g, '\n');
}
