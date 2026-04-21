import { z } from 'zod';

const platformSchema = z.enum(['darwin', 'linux', 'win32', 'wsl']);
export const normalizedScopeSchema = z.enum(['global', 'project', 'local']);
const checkSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([])
});

const brewInstallSchema = z.object({
  type: z.literal('brew'),
  name: z.string().min(1),
  packageType: z.enum(['formula', 'cask']).default('formula'),
  tap: z.string().min(1).optional()
});

const wingetInstallSchema = z.object({
  type: z.literal('winget'),
  id: z.string().min(1),
  exact: z.boolean().default(true)
});

const scoopInstallSchema = z.object({
  type: z.literal('scoop'),
  name: z.string().min(1),
  bucket: z.string().min(1).optional()
});

const npmInstallSchema = z.object({
  type: z.literal('npm'),
  package: z.string().min(1),
  bin: z.string().min(1).optional(),
  global: z.boolean().default(true)
});

const scriptInstallSchema = z.object({
  type: z.literal('script'),
  url: z.string().url(),
  args: z.array(z.string()).default([])
});

const powershellScriptInstallSchema = z.object({
  type: z.literal('powershell-script'),
  url: z.string().url(),
  args: z.array(z.string()).default([])
});

export const installStepSchema = z.discriminatedUnion('type', [
  brewInstallSchema,
  wingetInstallSchema,
  scoopInstallSchema,
  npmInstallSchema,
  scriptInstallSchema,
  powershellScriptInstallSchema
]);

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
);

const nativeCliInstallSchema = z.object({
  kind: z.literal('native-cli'),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.enum(['project', 'home']).default('project'),
  env: z.record(z.string(), z.string()).default({}),
  scopeMap: z
    .object({
      global: z.string().optional(),
      project: z.string().optional(),
      local: z.string().optional()
    })
    .default({}),
  restartRequired: z.boolean().default(false)
});

const jsonEnsureArrayContainsOperationSchema = z.object({
  op: z.literal('ensure-array-contains'),
  path: z.array(z.string()).default([]),
  value: z.string().min(1)
});

const jsonSetObjectEntryOperationSchema = z.object({
  op: z.literal('set-object-entry'),
  path: z.array(z.string()).default([]),
  key: z.string().min(1),
  value: jsonValueSchema
});

const jsonMergeObjectEntryOperationSchema = z.object({
  op: z.literal('merge-object-entry'),
  path: z.array(z.string()).default([]),
  key: z.string().min(1),
  value: z.record(z.string(), jsonValueSchema)
});

export const jsonConfigOperationSchema = z.discriminatedUnion('op', [
  jsonEnsureArrayContainsOperationSchema,
  jsonSetObjectEntryOperationSchema,
  jsonMergeObjectEntryOperationSchema
]);

const jsonConfigInstallSchema = z.object({
  kind: z.literal('json-config'),
  scopePaths: z.object({
    global: z.string().min(1).optional(),
    project: z.string().min(1).optional(),
    local: z.string().min(1).optional()
  }),
  operations: z.array(jsonConfigOperationSchema).default([]),
  restartRequired: z.boolean().default(false)
});

const tomlEnsureBoolOperationSchema = z.object({
  op: z.literal('ensure-bool'),
  section: z.string().min(1).optional(),
  key: z.string().min(1),
  value: z.boolean()
});

const tomlEnsureTableOperationSchema = z.object({
  op: z.literal('ensure-table'),
  header: z.string().min(1),
  lines: z.array(z.string()).default([])
});

export const tomlConfigOperationSchema = z.discriminatedUnion('op', [tomlEnsureBoolOperationSchema, tomlEnsureTableOperationSchema]);

const tomlConfigInstallSchema = z.object({
  kind: z.literal('toml-config'),
  scopePaths: z.object({
    global: z.string().min(1).optional(),
    project: z.string().min(1).optional(),
    local: z.string().min(1).optional()
  }),
  operations: z.array(tomlConfigOperationSchema).default([]),
  restartRequired: z.boolean().default(false)
});

const manualInstallSchema = z.object({
  kind: z.literal('manual'),
  instructions: z.array(z.string().min(1)).default([]),
  restartRequired: z.boolean().default(false)
});

export const catalogInstallSchema = z.discriminatedUnion('kind', [
  nativeCliInstallSchema,
  jsonConfigInstallSchema,
  tomlConfigInstallSchema,
  manualInstallSchema
]);

export const toolManifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['utility', 'runtime', 'ai-cli', 'developer-tool']),
  priority: z.number().int().default(100),
  supportedPlatforms: z.array(platformSchema).nonempty(),
  check: checkSchema,
  doctorHint: z.string().optional(),
  installs: z.object({
    darwin: z.array(installStepSchema).default([]),
    linux: z.array(installStepSchema).default([]),
    win32: z.array(installStepSchema).default([]),
    wsl: z.array(installStepSchema).default([])
  })
});

export const skillPackageSchema = z.object({
  source: z.string().min(1),
  skills: z.array(z.string()).default([]),
  description: z.string().optional()
});

export const domainManifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  extraToolIds: z.array(z.string()).default([]),
  integrationIds: z.array(z.string()).default([]),
  mcpServerIds: z.array(z.string()).default([]),
  skillPackages: z.array(skillPackageSchema).default([]),
  notes: z.array(z.string()).default([])
});

export const profileManifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['terminal-agent', 'editor-integrated', 'ecosystem', 'local-first']).optional(),
  extends: z.string().min(1).optional(),
  supportedPlatforms: z.array(platformSchema).nonempty(),
  toolIds: z.array(z.string()).default([]),
  integrationIds: z.array(z.string()).default([]),
  mcpServerIds: z.array(z.string()).default([]),
  defaultAgents: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([])
});

export const integrationManifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  targetAgent: z.string().min(1),
  supportedPlatforms: z.array(platformSchema).nonempty(),
  supportedScopes: z.array(normalizedScopeSchema).nonempty(),
  installKind: z.enum(['native-cli', 'json-config', 'toml-config', 'manual']),
  source: z.string().min(1),
  tags: z.array(z.string()).default([]),
  bundledMcpIds: z.array(z.string()).default([]),
  install: catalogInstallSchema
});

export const mcpManifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  serverName: z.string().min(1),
  targetAgents: z.array(z.string()).nonempty(),
  supportedPlatforms: z.array(platformSchema).nonempty(),
  supportedScopes: z.array(normalizedScopeSchema).nonempty(),
  serverKind: z.enum(['stdio', 'http', 'sse']),
  source: z.string().min(1),
  tags: z.array(z.string()).default([]),
  install: catalogInstallSchema
});

export type InstallStep = z.infer<typeof installStepSchema>;
export type ToolManifest = z.infer<typeof toolManifestSchema>;
export type DomainManifest = z.infer<typeof domainManifestSchema>;
export type ProfileManifest = z.infer<typeof profileManifestSchema>;
export type SkillPackage = z.infer<typeof skillPackageSchema>;
export type CommandCheck = z.infer<typeof checkSchema>;
export type NormalizedScope = z.infer<typeof normalizedScopeSchema>;
export type JsonConfigOperation = z.infer<typeof jsonConfigOperationSchema>;
export type TomlConfigOperation = z.infer<typeof tomlConfigOperationSchema>;
export type CatalogInstall = z.infer<typeof catalogInstallSchema>;
export type IntegrationManifest = z.infer<typeof integrationManifestSchema>;
export type McpManifest = z.infer<typeof mcpManifestSchema>;
