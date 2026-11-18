import { z } from "zod";
import { Rpc } from "@opencode/plugin/rpc";
import { configSchema } from "./core/config.js";
export const HeadersRpc = Rpc.define({
  id: "llmapi-custom-headers",
  events: {},
  methods: {
    read: {
      input: z.object({}),
      output: z.object({ revision: z.number(), config: configSchema }),
    },
    save: {
      input: z.object({ revision: z.number().int(), config: configSchema }),
      output: z.object({
        revision: z.number(),
        saved: z.boolean(),
        refreshed: z.boolean(),
        message: z.string(),
      }),
    },
    discover: {
      input: z.object({ route: z.string() }),
      output: z.array(
        z.object({
          id: z.string(),
          contextWindow: z.number().optional(),
          maxTokens: z.number().optional(),
        }),
      ),
    },
    refresh: { input: z.object({}), output: z.null() },
  },
});
