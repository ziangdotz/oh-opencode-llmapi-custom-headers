# opencode-llmapi-custom-headers

**v0.1.1** for **OpenCode 2.3.2**. One package exports Server, TUI and typed RPC. Manage custom LLM routes, HTTP headers and model discovery through `/llmapi-custom-headers`.

Selecting a route opens its full JSON directly, ordered api → baseURL → models → headers. There are no display-name or shared-integration fields. Each model input accepts text, image, or both. Enter adds a line, Tab indents, Ctrl+A selects all, Ctrl+S saves, and Esc returns to routes.

Esc returns editor → routes → main menu → close. The add wizard uses route ID → protocol → Base URL → model IDs → input types for each model → headers. Only the last step commits. Returning within the wizard retains confirmed values; leaving an editor discards unsaved edits.

## Install

Use Node.js 22+ for development. Run `npm ci`, then add the package's absolute directory to `plugins` in `opencode.json`. For explicit TUI loading on this local setup, add the same entry to `cli.json`. Merge existing configuration and restart OpenCode. No frontend build is required. This project does not claim an existing public npm release.

## Use

1. Open `/llmapi-custom-headers` and add a route.
2. Choose OpenAI Completions, OpenAI Responses or Anthropic Messages; enter the Base URL, model IDs, per-model input types, and finally headers JSON.
3. Run `/connect`, search for your route, select `LLM API Custom Headers · <route ID>` and save an API key.
4. Run `/models` and select the route's model.

Edit, discovery, deletion and refresh are menu actions. Each route owns the integration llmapi-<route ID>; manage its key with /connect. Stored legacy names and shared-integration references are removed on load. Routes previously using a shared integration need a key configured in their own integration. Deletion keeps saved keys.

## Development

Run `npm run verify:release` with Bun 1.4.3 before shipping: format, types, logic tests, native TUI checks and package-manifest checks. `npm pack` enforces the same gate. See [operations](docs/OPERATIONS.md) and [dependency review](docs/DEPENDENCY-REVIEW.md) for recovery, release evidence and unresolved upstream security reports.

`npm run verify` runs formatting checks, type checking and tests. `npm pack` repeats verification and produces the release tarball. The SDK is pinned to 2.3.2. Source code is loaded directly by OpenCode.

See [architecture](docs/ARCHITECTURE.md), [configuration](docs/CONFIGURATION.md), [development](docs/DEVELOPMENT.md), [release process](docs/RELEASING.md), [validation limits](docs/VALIDATION.md) and [changelog](CHANGELOG.md). Documents currently provide detailed Chinese guidance. Legacy retry/image-processing policies and Anthropic reasoning budgets are rejected; WebSocket and auxiliary-call acceptance remain incomplete. This release is not a claim of an independent security audit or production certification.
