import { z } from 'zod';

const platformSchema = z.enum(['darwin', 'linux']);

const brewInstallSchema = z.object({
  type: z.literal('brew'),
  name: z.string().min(1),
  packageType: z.enum(['formula', 'cask']).default('formula'),
  tap: z.string().min(1).optional()
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

export const installStepSchema = z.discriminatedUnion('type', [
  brewInstallSchema,
  npmInstallSchema,
  scriptInstallSchema
]);

export const toolManifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['utility', 'runtime', 'ai-cli', 'developer-tool']),
  priority: z.number().int().default(100),
  supportedPlatforms: z.array(platformSchema).nonempty(),
  checkCommand: z.string().min(1),
  doctorHint: z.string().optional(),
  installs: z.object({
    darwin: z.array(installStepSchema).default([]),
    linux: z.array(installStepSchema).default([])
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
  skillPackages: z.array(skillPackageSchema).default([]),
  notes: z.array(z.string()).default([])
});

export const profileManifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  supportedPlatforms: z.array(platformSchema).nonempty(),
  toolIds: z.array(z.string()).default([]),
  defaultAgents: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([])
});

export type InstallStep = z.infer<typeof installStepSchema>;
export type ToolManifest = z.infer<typeof toolManifestSchema>;
export type DomainManifest = z.infer<typeof domainManifestSchema>;
export type ProfileManifest = z.infer<typeof profileManifestSchema>;
export type SkillPackage = z.infer<typeof skillPackageSchema>;

