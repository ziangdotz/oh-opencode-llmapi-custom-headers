# opencode-llmapi-custom-headers

**v0.1.0** for **OpenCode 2.3.0**. One package exports Server, TUI and typed RPC. Manage custom LLM routes, HTTP headers and model discovery through `/llmapi-custom-headers`.

## Install

Use Node.js 22+ for development. Run `npm ci`, then add the package's absolute directory to `plugins` in `opencode.json`. On the tested 2.3.0 installation, the same entry in `cli.json` was needed for explicit TUI loading. Merge existing configuration and restart OpenCode. No frontend build is required. This project does not claim an existing public npm release.

## Use

1. Open `/llmapi-custom-headers` and add a route.
2. Choose OpenAI Completions, OpenAI Responses or Anthropic Messages; enter the Base URL, model IDs and headers JSON.
3. Run `/connect`, search for your route, select `LLM API Custom Headers · <name>` and save an API key.
4. Run `/models` and select the route's model.

Edit, discovery, deletion and refresh are menu actions. Discovery retains existing model capabilities and reasoning settings. Route deletion retains shared credentials. `credential` refers to an integration ID, never the secret itself.

## Development

`npm run verify` runs formatting checks, type checking and tests. `npm pack` repeats verification and produces the release tarball. The SDK is pinned to 2.3.0. Source code is loaded directly by OpenCode.

See [architecture](docs/ARCHITECTURE.md), [configuration](docs/CONFIGURATION.md), [development](docs/DEVELOPMENT.md), [release process](docs/RELEASING.md), [validation limits](docs/VALIDATION.md) and [changelog](CHANGELOG.md). Documents currently provide detailed Chinese guidance. Legacy retry/image-processing policies and Anthropic reasoning budgets are rejected; WebSocket and auxiliary-call acceptance remain incomplete. This release is not a claim of an independent security audit or production certification.
