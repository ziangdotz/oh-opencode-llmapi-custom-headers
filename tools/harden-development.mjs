import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// GHSA-fc5q-39xc-vjpf has no released fix. Harden the local development copy;
// repeated extglobs containing '*' become literals, as upstream does for risky patterns.
export function harden(root = "node_modules") {
  if (!existsSync(root)) return 0;
  const pending = [root];
  let patched = 0;
  const marker = "// local GHSA-fc5q-39xc-vjpf guard";
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(directory, entry.name);
      if (
        entry.name === "picomatch" &&
        existsSync(join(path, "package.json"))
      ) {
        const pkg = JSON.parse(
          readFileSync(join(path, "package.json"), "utf8"),
        );
        if (pkg.name !== "picomatch" || pkg.version !== "4.0.7")
          throw new Error(
            "Review unexpected picomatch version before applying hardening",
          );
        const target = join(path, "lib/parse.js");
        const source = readFileSync(target, "utf8");
        const anchor = "const analyzeRepeatedExtglob = (body, options) => {";
        if (!source.includes(marker)) {
          if (source.split(anchor).length !== 2)
            throw new Error("Unexpected picomatch source; refusing to patch");
          writeFileSync(
            target,
            source.replace(
              anchor,
              `${anchor}\n  ${marker}\n  if (body.includes('*')) return { risky: true };`,
            ),
          );
        }
        patched++;
      } else pending.push(path);
    }
  }
  return patched;
}
console.log(`Development glob hardening verified: ${harden()} copies`);
