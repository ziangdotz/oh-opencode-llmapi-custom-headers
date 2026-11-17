import type { Route } from "./config.js";
import type { DiscoveredModel } from "./discovery.js";
// Discovery adds inventory; it must not erase manually configured capabilities or variants.
export function mergeDiscoveredModels(
  existing: Route["models"],
  discovered: DiscoveredModel[],
): Route["models"] {
  const merged = new Map(existing.map((model) => [model.id, model]));
  for (const model of discovered)
    if (!merged.has(model.id))
      merged.set(model.id, {
        ...model,
        contextWindow: model.contextWindow ?? 262144,
        maxTokens: model.maxTokens ?? 32768,
        input: ["text"],
      });
  return [...merged.values()];
}
