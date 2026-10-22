/**
 * Clef decision models on Workers AI: given a state and typed questions,
 * they return a probability for every option of every question in one pass,
 * in a fraction of a second. powerhouse uses them where a model would only
 * pick from a list (routing, suggesting skills).
 */

export const CLEF_MODEL = "@cf/cloudflare/clef-flash";

export type ClefQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "noul"; instructions: string };

export interface ClefAnswer {
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  /** For yes/no questions, the probability of yes. */
  noul?: number;
}

/** Throws when the call fails, so callers can fall back. */
export async function clef(ai: Ai, state: string, questions: Record<string, ClefQuestion>) {
  // Decision models are not in the binding's generated model list. Called as
  // a method: the binding needs its `this`.
  const binding = ai as unknown as {
    run(model: string, inputs: unknown): Promise<{ answers?: Record<string, ClefAnswer> }>;
  };
  const { answers } = await binding.run(CLEF_MODEL, { questions, state });
  if (!answers) {
    throw new Error("The decision model returned no answers.");
  }
  return answers;
}

/** A skill as the role editor offers it. */
export interface SuggestableSkill {
  name: string;
  description: string;
}

/** Skills Clef thinks help a role, most likely first; at most `limit`, each at least `threshold` likely. */
export async function suggestSkills(
  ai: Ai,
  role: { name: string; purpose: string },
  skills: readonly SuggestableSkill[],
  { limit = 5, threshold = 0.5 } = {},
) {
  if (skills.length === 0) {
    return [];
  }
  const questions = Object.fromEntries(
    skills.map((skill) => [
      skill.name,
      { instructions: `Would the "${skill.name}" skill help this role? The skill: ${skill.description}`, type: "noul" as const },
    ]),
  );
  const answers = await clef(ai, `Role: ${role.name}. What it does: ${role.purpose}`, questions);
  return skills
    .map((skill) => ({ name: skill.name, probability: answers[skill.name]?.noul ?? 0 }))
    .filter((s) => s.probability >= threshold)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit);
}
