import {
  detectPlatform,
  getPowerhousePaths,
  isSupportedPlatform,
  loadRegistry,
  loadState,
  resolveBootstrapPlan,
  type DetectedPlatform,
  type SupportedPlatform
} from '@powerhouse/core';

import { formatPlan, formatPlanOverview } from '../ui/output.ts';

const DEFAULT_PROFILE_ID = 'claude-dev';
const DEFAULT_DOMAIN_ID = 'general';

export interface PlanCommandOptions {
  profile?: string;
  domain?: string;
  platform?: SupportedPlatform;
  json?: boolean;
}

export async function runPlanCommand(options: PlanCommandOptions): Promise<void> {
  const detectedPlatform = detectPlatform();
  const registry = await loadRegistry();
  const state = await loadState(getPowerhousePaths(detectedPlatform));
  const platform = resolveRequestedPlatform(detectedPlatform, options.platform);
  const profileId = options.profile ?? state?.activeProfileId ?? DEFAULT_PROFILE_ID;
  const domainId = options.domain ?? state?.activeDomainId ?? DEFAULT_DOMAIN_ID;
  const plan = resolveBootstrapPlan(registry, platform, profileId, domainId);

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
            checkCommand: tool.checkCommand
          })),
          skillPackages: plan.domain.skillPackages,
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
  requestedPlatform: SupportedPlatform | undefined
): DetectedPlatform & { os: SupportedPlatform } {
  if (requestedPlatform) {
    return {
      ...detectedPlatform,
      os: requestedPlatform
    };
  }

  if (!isSupportedPlatform(detectedPlatform)) {
    return {
      ...detectedPlatform,
      os: 'darwin'
    };
  }

  return detectedPlatform;
}

