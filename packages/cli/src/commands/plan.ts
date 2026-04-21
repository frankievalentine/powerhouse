import {
  computePruneAnalysis,
  detectPlatform,
  getPowerhousePaths,
  isPlanPlatform,
  loadLedger,
  loadRegistry,
  loadState,
  resolveBootstrapPlan,
  summarizeToolOwnership,
  type DetectedPlatform,
  type PlatformTarget
} from '@powerhouse/core';

import { formatPlan, formatPlanOverview } from '../ui/output.ts';

const DEFAULT_PROFILE_ID = 'claude';
const DEFAULT_DOMAIN_ID = 'general';

export interface PlanCommandOptions {
  profile?: string;
  domain?: string;
  platform?: PlatformTarget;
  json?: boolean;
  integrationScope?: 'auto' | 'global' | 'project' | 'local';
  mcpScope?: 'auto' | 'global' | 'project' | 'local';
}

export async function runPlanCommand(options: PlanCommandOptions): Promise<void> {
  const detectedPlatform = detectPlatform();
  const registry = await loadRegistry();
  const paths = getPowerhousePaths(detectedPlatform);
  const state = await loadState(paths);
  const ledger = await loadLedger(paths);
  const platform = resolveRequestedPlatform(detectedPlatform, options.platform);
  const profileId = options.profile ?? state?.activeProfileId ?? DEFAULT_PROFILE_ID;
  const domainId = options.domain ?? state?.activeDomainId ?? DEFAULT_DOMAIN_ID;
  const plan = resolveBootstrapPlan(registry, platform, profileId, domainId);
  const pruneAnalysis = computePruneAnalysis(ledger, plan);
  const toolOwnership = summarizeToolOwnership(ledger);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          platform: platform.os,
          profile: plan.profile.id,
          domain: plan.domain.id,
          agents: plan.agents,
          tools: plan.tools.map((tool) => ({
            id: tool.id,
            title: tool.title,
            kind: tool.kind,
            check: tool.check,
            ownership: toolOwnership.managed.some((entry) => entry.toolId === tool.id) ? 'installed' : 'preexisting'
          })),
          integrations: plan.integrations.map((integration) => ({
            id: integration.id,
            title: integration.title,
            targetAgent: integration.targetAgent,
            scopes: integration.supportedScopes,
            source: integration.source
          })),
          mcpServers: plan.mcpServers.map((server) => ({
            id: server.id,
            title: server.title,
            targetAgents: server.targetAgents,
            scopes: server.supportedScopes,
            source: server.source
          })),
          skillPackages: plan.domain.skillPackages,
          requestedScopes: {
            integrations: options.integrationScope ?? 'auto',
            mcp: options.mcpScope ?? 'auto'
          },
          trackedToolOwnership: {
            managed: toolOwnership.managed.map((entry) => entry.toolId),
            preexisting: toolOwnership.preexisting.map((entry) => entry.toolId)
          },
          pruneCandidates: {
            tools: pruneAnalysis.tools.map((entry) => entry.toolId),
            skills: pruneAnalysis.skills.map((entry) => `${entry.source}:${entry.skillName ?? '*'}`),
            integrations: pruneAnalysis.integrations.map((entry) => entry.id),
            mcpServers: pruneAnalysis.mcpServers.map((entry) => entry.id),
            blocked: pruneAnalysis.blocked.map((entry) =>
              entry.kind === 'tool' ? entry.toolId : entry.kind === 'skill' ? entry.source : entry.id
            )
          },
          notes: plan.notes
        },
        null,
        2
      )
    );
    return;
  }

  console.log(formatPlanOverview(plan));
  console.log(`Platform ${platform.os}`);
  console.log('');
  console.log(formatPlan(plan));
}

function resolveRequestedPlatform(
  detectedPlatform: DetectedPlatform,
  requestedPlatform: PlatformTarget | undefined
): DetectedPlatform & { os: PlatformTarget } {
  if (requestedPlatform) {
    return {
      ...detectedPlatform,
      os: requestedPlatform
    };
  }

  if (!isPlanPlatform(detectedPlatform)) {
    return {
      ...detectedPlatform,
      os: 'darwin'
    };
  }

  return detectedPlatform;
}
