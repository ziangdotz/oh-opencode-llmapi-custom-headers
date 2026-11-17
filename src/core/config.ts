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
    name: z.string().optional(),
    contextWindow: z.number().int().positive().default(262144),
    maxTokens: z.number().int().positive().default(32768),
    input: z.array(z.enum(["text", "image"])).default(["text"]),
    reasoningEfforts: z
      .union([z.literal(false), z.record(z.string(), z.string().nullable())])
      .optional(),
  })
  .strict();
export const routeSchema = z
  .object({
    displayName: z.string().optional(),
    api: protocol,
    baseURL: z.url().refine((s) => /^https?:/.test(s)),
    credential: z.string().min(1).optional(),
    headers: z.record(z.string(), z.string()).default({}),
    models: z.array(modelSchema).default([]),
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
// Strict schemas deliberately reject legacy fields without an equivalent, never silently drop them.
export function migrateConfig(input: unknown): Config {
  return configSchema.parse(input);
}
