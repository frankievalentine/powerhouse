import {
  computePruneAnalysis,
  detectPlatform,
  getPowerhousePaths,
  isPlanPlatform,
  loadLedger,
  loadRegistry,
  loadState,
  resolveSetupPlan,
  resolveDomainSkillPackages,
  summarizeToolOwnership,
  type DetectedPlatform,
  type PlatformTarget
} from '@powerhouse/core';

import { formatPlatform, formatPlan, formatPlanOverview } from '../ui/output.ts';
import { getActiveSelection } from './selection.ts';

export interface PlanCommandOptions {
  harness?: string[];
  domain?: string[];
  tool?: string[];
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
  const activeSelection = getActiveSelection(state);
  const harnessIds = options.harness && options.harness.length > 0 ? options.harness : activeSelection.harnessIds;
  const domainIds = options.domain && options.domain.length > 0 ? options.domain : activeSelection.domainIds;
  const selectedToolIds = options.tool && options.tool.length > 0 ? options.tool : state?.selectedToolIds;
  const plan = resolveSetupPlan(registry, platform, harnessIds, domainIds, selectedToolIds);
  const pruneAnalysis = computePruneAnalysis(ledger, plan);
  const toolOwnership = summarizeToolOwnership(ledger);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          platform: platform.os,
          harnesses: plan.harnesses.map((harness) => harness.id),
          domains: plan.domains.map((domain) => domain.id),
          selectedOptionalToolIds: plan.selectedOptionalTools.map((tool) => tool.id),
          agents: plan.agents,
          requiredTools: plan.requiredTools.map((tool) => tool.id),
          recommendedTools: plan.recommendedTools.map((tool) => tool.id),
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
          skillPackages: resolveDomainSkillPackages(plan.domains),
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
  console.log(`Target platform: ${formatPlatform(platform.os)}`);
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
