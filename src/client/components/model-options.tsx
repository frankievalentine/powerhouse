import { MODELS, type ModelProvider } from "../../shared";

const GROUPS: { provider: ModelProvider; label: string }[] = [
  { label: "Claude, through AI Gateway", provider: "anthropic" },
  { label: "OpenAI, through AI Gateway", provider: "openai" },
  { label: "Open models on Workers AI", provider: "workers-ai" },
];

/**
 * <option>s for a model <select>, grouped by who serves them. Vendor models
 * whose vendor is not set up on the gateway stay visible but disabled, so
 * people can see what setup would add.
 */
export function ModelOptions({ providers, only }: { providers: readonly ModelProvider[]; only?: ModelProvider }) {
  return (
    <>
      {GROUPS.filter((g) => !only || g.provider === only).map((group) => {
        const ready = group.provider === "workers-ai" || providers.includes(group.provider);
        return (
          <optgroup key={group.provider} label={ready ? group.label : `${group.label} (not set up)`}>
            {MODELS.filter((m) => m.provider === group.provider).map((m) => (
              <option disabled={!ready} key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

/** What "auto" resolves to right now, for labels like "Automatic (Claude Opus 5.5)". */
export function autoModelLabel(providers: readonly ModelProvider[]) {
  if (providers.includes("anthropic")) {
    return MODELS.find((m) => m.id === "anthropic/claude-opus-5-5")?.label;
  }
  if (providers.includes("openai")) {
    return MODELS.find((m) => m.id === "openai/gpt-6-sol")?.label;
  }
  return MODELS.find((m) => m.provider === "workers-ai")?.label;
}
