import { z } from "zod";
import { assertValidHeaders } from "./headers.js";
export const protocol = z.enum([
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
]);
export type SupportedProtocol = z.infer<typeof protocol>;
export const modelSchema = z
  .object({
    id: z.string().min(1),
    contextWindow: z.number().int().positive().default(262144),
    maxTokens: z.number().int().positive().default(32768),
    input: z
      .array(z.enum(["text", "image"]))
      .min(1)
      .default(["text"]),
    reasoningEfforts: z
      .union([z.literal(false), z.record(z.string(), z.string().nullable())])
      .optional(),
  })
  .strict();
export const routeSchema = z
  .object({
    api: protocol,
    baseURL: z.url().refine((s) => /^https?:/.test(s)),
    models: z.array(modelSchema).default([]),
    headers: z.record(z.string(), z.string()).default({}),
  })
  .strict()
  .superRefine((r, c) => {
    try {
      assertValidHeaders("route", r.headers);
    } catch (e) {
      c.addIssue({ code: "custom", message: (e as Error).message });
    }
    if (
      r.api === "anthropic-messages" &&
      r.models.some(
        (m) => m.reasoningEfforts && Object.keys(m.reasoningEfforts).length,
      )
    )
      c.addIssue({
        code: "custom",
        message:
          "Anthropic reasoning efforts require thinking budgets; import is not supported yet",
      });
    if (new Set(r.models.map((m) => m.id)).size !== r.models.length)
      c.addIssue({ code: "custom", message: "Duplicate model IDs" });
  });
export const configSchema = z
  .object({
    version: z.literal(1).default(1),
    providers: z
      .record(z.string().regex(/^[a-zA-Z0-9_-]+$/), routeSchema)
      .default({}),
  })
  .strict();
export type Config = z.infer<typeof configSchema>;
export type Route = z.infer<typeof routeSchema>;
// Loading removes retired naming/sharing fields; new saves still use the strict schema.
export function migrateConfig(input: unknown): Config {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return configSchema.parse(input);
  const value = input as Record<string, unknown>;
  if (
    typeof value.providers !== "object" ||
    value.providers === null ||
    Array.isArray(value.providers)
  )
    return configSchema.parse(input);
  const providers = Object.fromEntries(
    Object.entries(value.providers).map(([id, raw]) => {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw))
        return [id, raw];
      const { displayName, credential, ...route } = raw as Record<
        string,
        unknown
      >;
      if (Array.isArray(route.models))
        route.models = route.models.map((model) => {
          if (
            typeof model !== "object" ||
            model === null ||
            Array.isArray(model)
          )
            return model;
          const { name, ...rest } = model as Record<string, unknown>;
          return rest;
        });
      return [id, route];
    }),
  );
  return configSchema.parse({ ...value, providers });
}
