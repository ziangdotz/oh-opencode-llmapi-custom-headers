import type { Plugin } from "@opencode/plugin";
import { configSchema, type Config } from "../core/config.js";
export class ConfigStore {
  private pending: Promise<unknown> = Promise.resolve();
  revision = 0;
  config: Config = configSchema.parse({});
  constructor(private storage: Plugin.Context["storage"]) {}
  async load(options: unknown) {
    const saved = await this.storage.get("configuration");
    if (saved) {
      const state = saved as { revision: number; config: unknown };
      this.config = configSchema.parse(state.config);
      this.revision = state.revision;
    } else this.config = configSchema.parse(options);
  }
  save(revision: number, input: unknown) {
    const run = this.pending.then(async () => {
      if (revision !== this.revision)
        throw new Error("SAVE_CONFLICT: reload configuration before saving");
      const config = configSchema.parse(input),
        next = this.revision + 1;
      await this.storage.set("configuration", { revision: next, config });
      this.config = config;
      this.revision = next;
      return next;
    });
    this.pending = run.catch(() => {});
    return run;
  }
}
