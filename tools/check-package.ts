import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
assert.equal(manifest.version, "0.1.0");
assert.equal(lock.version, manifest.version);
assert.equal(lock.packages[""].version, manifest.version);
assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
assert.deepEqual(lock.packages[""].devDependencies, manifest.devDependencies);
assert.equal(manifest.devDependencies["@opencode/plugin"], "2.4.2");
assert.equal(manifest.devDependencies["@opencode/theme"], "2.4.2");
assert.equal(manifest.devDependencies["@opentui/core"], "0.9.9");
assert.equal(manifest.devDependencies["@opentui/solid"], "0.9.9");
assert.ok(
  !manifest.dependencies["@opencode/plugin"],
  "SDK must be supplied by the host, not installed as a production dependency",
);
const npm = process.env.npm_execpath;
assert.ok(npm, "Run with npm run check:package");
const packed = spawnSync(
  process.execPath,
  [npm, "pack", "--dry-run", "--ignore-scripts", "--json"],
  { encoding: "utf8" },
);
assert.equal(packed.status, 0, packed.stderr);
const [archive] = JSON.parse(packed.stdout);
const files = new Set<string>(
  archive.files.map((file: { path: string }) => file.path),
);
const rootFiles = new Set([
  "package.json",
  "README.md",
  "README.en.md",
  "CHANGELOG.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "tools/harden-development.mjs",
]);
for (const path of files) {
  assert.ok(
    rootFiles.has(path) ||
      /^(src\/.*\.ts|docs\/.*\.md|examples\/.*\.json)$/.test(path),
    `Unexpected packaged file: ${path}`,
  );
  assert.ok(
    !path
      .split("/")
      .some((part) => part.startsWith(".") || part === "node_modules"),
    `Private path: ${path}`,
  );
}
for (const target of Object.values(manifest.exports) as string[])
  assert.ok(
    files.has(target.replace(/^\.\//, "")),
    `Missing export: ${target}`,
  );
assert.ok(files.has("src/tui/multiline-editor.ts"));
console.log(
  `PASS release package ${manifest.version}: ${files.size} approved files; exports and lockfile match`,
);
