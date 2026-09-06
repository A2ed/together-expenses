import snapshot from "../shared/openai-models.json" with { type: "json" };
export const efforts = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];
export function normalizeModels(data) {
  return data
    .filter(
      (m) =>
        m.id.startsWith("openai/") &&
        !m.id.includes(":") &&
        m.architecture?.output_modalities?.length === 1 &&
        m.architecture.output_modalities[0] === "text" &&
        m.supported_parameters?.includes("response_format"),
    )
    .map((m) => ({
      id: m.id,
      name: m.name.replace(/^OpenAI:\s*/, ""),
      efforts:
        m.reasoning?.supported_efforts === null
          ? efforts.filter((e) => e !== "none" || !m.reasoning.mandatory)
          : (m.reasoning?.supported_efforts || []).filter(
              (e) =>
                efforts.includes(e) && (e !== "none" || !m.reasoning.mandatory),
            ),
      defaultEffort: m.reasoning?.default_effort || null,
      maxOutput: m.top_provider?.max_completion_tokens || 16384,
    }));
}
let cached = snapshot,
  refreshed = 0,
  pending;
export async function getModels() {
  if (Date.now() - refreshed < 3600000) return cached;
  if (!pending)
    pending = (async () => {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error("Catalog unavailable");
        const models = normalizeModels((await response.json()).data);
        if (!models.length) throw new Error("Empty catalog");
        cached = models;
      } catch {
        /* Keep the last usable catalog, including the bundled snapshot. */
      }
      refreshed = Date.now();
      pending = undefined;
      return cached;
    })();
  return pending;
}
export function reasoningOptions(model, effort = "default") {
  if (effort === "default") return {};
  if (!model?.efforts.includes(effort))
    throw Object.assign(
      new Error(
        "This model does not support that reasoning effort. Choose another setting.",
      ),
      { status: 400 },
    );
  return { reasoning: { effort, exclude: true } };
}
export function completionOptions(model, effort = "default") {
  const reasoning = reasoningOptions(model, effort);
  const active =
    effort !== "none" && (effort !== "default" || model?.efforts.length);
  return {
    ...reasoning,
    max_tokens: Math.min(
      model?.maxOutput || 16384,
      active ? (["xhigh", "max"].includes(effort) ? 65536 : 16384) : 2500,
    ),
  };
}
