import type { SetupPlan } from './resolve.ts';
import { detectCatalogDrift } from './integrations.ts';
import { planManagedSkills } from './skills.ts';
import type {
  IntegrationLedgerEntry,
  LedgerEntry,
  McpLedgerEntry,
  PowerhouseLedger,
  SkillLedgerEntry,
  ToolLedgerEntry
} from '../state/ledger.ts';

export interface PruneAnalysis {
  tools: ToolLedgerEntry[];
  skills: SkillLedgerEntry[];
  integrations: IntegrationLedgerEntry[];
  mcpServers: McpLedgerEntry[];
  blocked: Array<ToolLedgerEntry | SkillLedgerEntry | IntegrationLedgerEntry | McpLedgerEntry>;
}

export interface DriftFinding {
  kind: 'integration' | 'mcp';
  id: string;
  files: string[];
}

export function computePruneAnalysis(ledger: PowerhouseLedger, plan: SetupPlan | null): PruneAnalysis {
  if (!plan) {
    return {
      tools: [],
      skills: [],
      integrations: [],
      mcpServers: [],
      blocked: []
    };
  }

  const plannedToolIds = new Set(plan.tools.map((tool) => tool.id));
  const plannedSkillKeys = new Set(
    planManagedSkills(plan.domains, plan.agents).map((record) => `${record.source}:${record.skillName ?? '*'}:${record.agent}:${record.scope}`)
  );
  const plannedIntegrationIds = new Set(plan.integrations.map((integration) => integration.id));
  const plannedMcpIds = new Set(plan.mcpServers.map((server) => server.id));

  const removableTools: ToolLedgerEntry[] = [];
  const removableSkills: SkillLedgerEntry[] = [];
  const removableIntegrations: IntegrationLedgerEntry[] = [];
  const removableMcpServers: McpLedgerEntry[] = [];
  const blocked: Array<ToolLedgerEntry | SkillLedgerEntry | IntegrationLedgerEntry | McpLedgerEntry> = [];

  for (const entry of ledger.entries) {
    if (entry.kind === 'tool') {
      if (plannedToolIds.has(entry.toolId) || entry.ownership !== 'installed') {
        continue;
      }
      if (entry.removable) {
        removableTools.push(entry);
      } else {
        blocked.push(entry);
      }
      continue;
    }

    if (entry.kind === 'skill') {
      const key = `${entry.source}:${entry.skillName ?? '*'}:${entry.agent}:${entry.scope}`;
      if (plannedSkillKeys.has(key)) {
        continue;
      }
      if (entry.removable) {
        removableSkills.push(entry);
      } else {
        blocked.push(entry);
      }
      continue;
    }

    if (entry.kind === 'integration') {
      if (plannedIntegrationIds.has(entry.id)) {
        continue;
      }
      if (entry.removable) {
        removableIntegrations.push(entry);
      } else {
        blocked.push(entry);
      }
      continue;
    }

    if (entry.kind === 'mcp') {
      if (plannedMcpIds.has(entry.id)) {
        continue;
      }
      if (entry.removable) {
        removableMcpServers.push(entry);
      } else {
        blocked.push(entry);
      }
    }
  }

  return {
    tools: removableTools,
    skills: removableSkills,
    integrations: removableIntegrations,
    mcpServers: removableMcpServers,
    blocked
  };
}

export function summarizeToolOwnership(ledger: PowerhouseLedger): { managed: ToolLedgerEntry[]; preexisting: ToolLedgerEntry[] } {
  const managed: ToolLedgerEntry[] = [];
  const preexisting: ToolLedgerEntry[] = [];

  for (const entry of ledger.entries) {
    if (entry.kind !== 'tool') {
      continue;
    }

    if (entry.ownership === 'installed') {
      managed.push(entry);
    } else {
      preexisting.push(entry);
    }
  }

  managed.sort((left, right) => left.toolId.localeCompare(right.toolId));
  preexisting.sort((left, right) => left.toolId.localeCompare(right.toolId));
  return { managed, preexisting };
}

export async function detectLedgerDrift(ledger: PowerhouseLedger): Promise<DriftFinding[]> {
  const findings: DriftFinding[] = [];

  for (const entry of ledger.entries) {
    if (entry.kind !== 'integration' && entry.kind !== 'mcp') {
      continue;
    }

    const files = await detectCatalogDrift(entry);
    if (files.length === 0) {
      continue;
    }

    findings.push({
      kind: entry.kind,
      id: entry.id,
      files
    });
  }

  return findings;
}

export function ledgersForRemoval(
  analysis: PruneAnalysis
): Array<ToolLedgerEntry | SkillLedgerEntry | IntegrationLedgerEntry | McpLedgerEntry> {
  return [...analysis.tools, ...analysis.skills, ...analysis.integrations, ...analysis.mcpServers];
}
