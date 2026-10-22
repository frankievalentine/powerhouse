import { Output } from "ai";
import { clef } from "./clef";

/** What the router sees of a role. */
export interface RoutableRole {
  id: string;
  name: string;
  purpose: string;
}

/**
 * The routing request: one constrained call whose output can only be a role
 * id. Shared by Org and scripts/route-eval.ts, so the eval measures exactly
 * what production sends.
 */
export function routeRequest(prompt: string, roles: readonly RoutableRole[]) {
  return {
    output: Output.choice({ options: roles.map((r) => r.id) }),
    prompt: `Pick the role best suited to this job.\n\nRoles:\n${roles
      .map((r) => `- ${r.id}: ${r.name}. ${r.purpose}`)
      .join("\n")}\n\nJob: ${prompt}`,
  };
}

/**
 * The same decision for a Clef decision model on Workers AI: the job as the
 * state and one choice question whose options are the roles. Clef answers
 * with a probability for every role, so callers can tell a confident pick
 * from a guess.
 */
export function clefRouteRequest(prompt: string, roles: readonly RoutableRole[]) {
  return {
    questions: {
      role: {
        criteria: Object.fromEntries(roles.map((r) => [r.id, `${r.name}. ${r.purpose}`])),
        instructions: "Which role is best suited to this job?",
        type: "choice" as const,
      },
    },
    state: `Job: ${prompt}`,
  };
}

/** Below this probability the router's pick is a guess, and the fallback role takes the job. */
export const ROUTE_CONFIDENCE = 0.5;

/** The role Clef picks and how sure it is; throws when the call fails, so callers can fall back. */
export async function clefRoute(ai: Ai, prompt: string, roles: readonly RoutableRole[]) {
  const { questions, state } = clefRouteRequest(prompt, roles);
  const answer = (await clef(ai, state, questions)).role;
  if (!answer?.choice || !roles.some((r) => r.id === answer.choice)) {
    throw new Error("The router returned no usable role.");
  }
  return { probability: answer.probabilities?.[answer.choice] ?? answer.confidence ?? 0, roleId: answer.choice };
}
