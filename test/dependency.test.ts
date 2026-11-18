import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("development glob guard bounds malicious repeated extglobs", () => {
  const child = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const assert = require('node:assert/strict');
    const pm = require('picomatch');
    for(const pattern of ['+(*)', '+(*a)', '*(*a)', '+(*|a)']) {
      assert.equal(pm.isMatch('a'.repeat(80)+'!',pattern),false);
    }
    assert.equal(pm.isMatch('src/index.ts','**/*.ts'),true);
    assert.equal(pm.isMatch('ab','+(a|b)'),true);
  `,
    ],
    { timeout: 2000, encoding: "utf8" },
  );
  assert.equal(child.status, 0, String(child.error ?? child.stderr));
});
