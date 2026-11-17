import type { Plugin } from "@opencode/plugin";
import type { Route } from "../core/config.js";
export async function resolveKey(
  ctx: Plugin.Context,
  route: Route,
  defaultIntegration: string,
) {
  const integration = route.credential ?? defaultIntegration;
  const connection = await ctx.integration.connection.active(integration);
  if (!connection) {
    if (route.credential)
      throw new Error(`Credential unavailable: ${integration}`);
    return undefined;
  }
  const value = await ctx.integration.connection.resolve(connection);
  if (value?.type !== "key")
    throw new Error("This route requires an API key credential");
  return value.key;
}
