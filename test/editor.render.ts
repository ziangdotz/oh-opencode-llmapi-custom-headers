import assert from "node:assert/strict";
import { createTestRenderer } from "@opentui/core/testing";
import type { CliRenderer } from "@opentui/core";
import { TextareaRenderable, RGBA } from "@opentui/core";
import { multilineEditor } from "../src/tui/multiline-editor.js";
import type { Plugin } from "@opencode/plugin/tui";
import type { ResolvedTheme } from "@opencode/theme/tui";
let draw!: () => any;
let close!: () => void;
let cleared = false;
let draft = "{}";
const colors = {
  text: {
    base: RGBA.fromHex("#eeeeee"),
    muted: RGBA.fromHex("#999999"),
    feedback: {
      error: { base: RGBA.fromHex("#ff0000"), muted: RGBA.fromHex("#aa0000") },
    },
  },
  background: { formfield: { base: RGBA.fromHex("#222222") } },
} satisfies {
  text: Pick<ResolvedTheme["text"], "base" | "muted"> & {
    feedback: Pick<ResolvedTheme["text"]["feedback"], "error">;
  };
  background: {
    formfield: Pick<ResolvedTheme["background"]["formfield"], "base">;
  };
};
const ctx = {
  theme: { surface: () => colors },
  ui: {
    dialog: {
      show: (render: any, onClose: any) => {
        draw = render;
        close = onClose;
      },
      set: () => {},
      clear: () => {
        cleared = true;
        close();
      },
    },
  },
} as unknown as Plugin.Context;
// Deliberately no Solid root or RendererContext: this reproduces the host boundary.
const ui = await createTestRenderer({ width: 80, height: 30 });
(ctx as { renderer: CliRenderer }).renderer = ui.renderer;
const listenersBefore = ui.renderer.listenerCount("resize");
const result = multilineEditor(ctx, {
  title: "Headers / 请求头",
  description: "Edit JSON",
  value: "{}",
  onDraft: (value) => {
    draft = value;
  },
  rows: 12,
  validate: (value) => {
    JSON.parse(value);
  },
});
ui.renderer.root.add(draw());
try {
  await ui.flush();
  const find = (node: any): TextareaRenderable | undefined =>
    node instanceof TextareaRenderable
      ? node
      : node.getChildren?.().map(find).find(Boolean);
  const input = find(ui.renderer.root)!;
  assert.ok(input);
  assert.equal(input.height, 12);
  ui.mockInput.pressKey("a", { ctrl: true });
  await ui.mockInput.pasteBracketedText('{\n"hello": "world"\n}');
  await ui.flush();
  assert.match(input.plainText, /\n/);
  ui.mockInput.pressKey("a", { ctrl: true });
  await ui.mockInput.typeText("{");
  ui.mockInput.pressKey("s", { ctrl: true });
  await ui.flush();
  assert.equal(cleared, false);
  assert.equal(input.plainText, "{");
  assert.equal(draft, "{");
  assert.match(ui.captureCharFrame(), /JSON/);
  ui.mockInput.pressEnter();
  ui.mockInput.pressTab();
  await ui.mockInput.typeText('"ok": true\n}');
  await ui.flush();
  assert.equal(input.plainText, '{\n  "ok": true\n}');
  ui.resize(50, 18);
  await ui.flush();
  assert.equal(input.height, 6);
  ui.mockInput.pressKey("s", { ctrl: true });
  assert.equal(await result, '{\n  "ok": true\n}');
  assert.equal(cleared, true);
  assert.equal(ui.renderer.listenerCount("resize"), listenersBefore);
  console.log(
    "PASS editor rendering, multiline paste, Enter, Tab, validation retention, Ctrl+S and resize",
  );
} finally {
  await ui.dispose();
}
const backUI = await createTestRenderer({ width: 80, height: 30 });
(ctx as { renderer: CliRenderer }).renderer = backUI.renderer;
const backListeners = backUI.renderer.listenerCount("resize");
const cancelled = multilineEditor(ctx, {
  title: "Cancel",
  value: "unchanged",
  rows: 8,
  validate: () => {},
  onDraft: (value) => {
    draft = value;
  },
});
backUI.renderer.root.add(draw());
try {
  await backUI.flush();
  backUI.mockInput.pressKey("a", { ctrl: true });
  await backUI.mockInput.typeText("unsaved draft");
  await backUI.flush();
  assert.equal(draft, "unsaved draft");
  await backUI.mockMouse.click(3, 0);
  assert.equal(await cancelled, undefined);
  assert.equal(backUI.renderer.listenerCount("resize"), backListeners);
  assert.equal(draft, "unsaved draft");
  console.log(
    "PASS visible back control dismisses without saving and retains draft",
  );
} finally {
  await backUI.dispose();
}
