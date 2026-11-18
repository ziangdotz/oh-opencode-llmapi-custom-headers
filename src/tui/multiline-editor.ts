import type { Plugin } from "@opencode/plugin/tui";
import {
  BoxRenderable,
  TextRenderable,
  TextareaRenderable,
} from "@opentui/core";
import type { JSX } from "@opentui/solid";
import type { EditorOptions } from "./editor-options.js";

/** Use the SDK renderer directly: a plugin dialog may run outside Solid's RendererContext. */
export function multilineEditor(
  ctx: Plugin.Context,
  options: EditorOptions,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    let cleanup = () => {};
    const finish = (value: string | undefined) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    ctx.ui.dialog.show(
      () => {
        ctx.ui.dialog.set({ size: "xlarge" });
        const renderer = ctx.renderer;
        const theme = ctx.theme.surface("dialog");
        const box = new BoxRenderable(renderer, {
          flexDirection: "column",
          paddingLeft: 1,
          paddingRight: 1,
        });
        const heading = new TextRenderable(renderer, {
          content: `Back / 返回 · ${options.title}`,
          height: 1,
          fg: theme.text.base,
        });
        heading.onMouseDown = () => ctx.ui.dialog.clear();
        box.add(heading);
        box.add(
          new TextRenderable(renderer, {
            content: options.description ?? "",
            height: 2,
            fg: theme.text.muted,
          }),
        );
        const rows = () =>
          Math.max(1, Math.min(options.rows, renderer.height - 12));
        const input = new TextareaRenderable(renderer, {
          initialValue: options.value,
          width: "100%",
          height: rows(),
          wrapMode: "word",
          textColor: theme.text.base,
          backgroundColor: theme.background.formfield.base,
          keyBindings: [
            { name: "s", ctrl: true, action: "submit" },
            { name: "a", ctrl: true, action: "select-all" },
          ],
        });
        box.add(input);
        const error = new TextRenderable(renderer, {
          content: "",
          height: 2,
          fg: theme.text.feedback.error.base,
        });
        box.add(error);
        box.add(
          new TextRenderable(renderer, {
            content:
              "Enter Newline / 换行 · Tab Indent / 缩进\nCtrl+S Save / 保存 · Esc Back / 返回",
            height: 2,
            fg: theme.text.muted,
          }),
        );
        input.onContentChange = () => options.onDraft?.(input.plainText);
        input.onSubmit = () => {
          const value = input.plainText;
          try {
            options.validate(value);
          } catch (e) {
            error.content = (
              e instanceof Error ? e.message : String(e)
            ).replace(/\s+/g, " ");
            return;
          }
          finish(value);
          ctx.ui.dialog.clear();
        };
        input.onKeyDown = (event) => {
          if (
            event.name === "tab" &&
            !event.shift &&
            !event.ctrl &&
            !event.meta
          ) {
            event.preventDefault();
            input.insertText("  ");
          }
        };
        const resize = () => {
          input.height = rows();
        };
        renderer.on("resize", resize);
        cleanup = () => renderer.off("resize", resize);
        box.on("destroyed", () => finish(undefined));
        input.focus();
        return box as unknown as JSX.Element;
      },
      () => finish(undefined),
    );
  });
}
