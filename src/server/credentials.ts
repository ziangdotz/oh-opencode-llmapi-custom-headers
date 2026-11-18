import type { Plugin } from "@opencode/plugin";
export async function resolveKey(
  ctx: Plugin.Context,
  defaultIntegration: string,
) {
  const integration = defaultIntegration;
  const connection = await ctx.integration.connection.active(integration);
  if (!connection) return undefined;
  const value = await ctx.integration.connection.resolve(connection);
  if (value?.type !== "key")
    throw new Error("This route requires an API key credential");
  return value.key;
}
