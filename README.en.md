# opencode-llmapi-custom-headers

**OpenCode V2 plugin · v0.1.0 · host baseline 2.4.1**

Manage custom LLM routes, HTTP headers and model catalogs from the OpenCode terminal. One package provides the server plugin, the TUI management surface and a typed RPC contract, with `/llmapi-custom-headers` as the single entry point.

Supported wire protocols:

- OpenAI Chat Completions (`openai-completions`)
- OpenAI Responses (`openai-responses`)
- Anthropic Messages (`anthropic-messages`)

> **Delivery status**: this build adapts the plugin to the locally installed OpenCode 2.4.1 and completes engineering verification. **No model generation call or remote model discovery was executed.** Validate real credentials, full streaming responses, image input and live WebSocket sessions in your own environment; see [Validation and compatibility](docs/VALIDATION.md).

## Compatibility

| Item                     | Version / requirement           |
| ------------------------ | ------------------------------- |
| Plugin                   | `0.1.0` (published as `v0.1.0`) |
| Configuration schema     | `1`                             |
| Local OpenCode           | `2.4.1`                         |
| `@opencode/plugin` (dev) | `2.4.1`                         |
| `@opencode/theme` (dev)  | `2.4.1`                         |
| OpenTUI (dev)            | `0.9.4`                         |
| Node.js (development)    | `>=22`                          |
| Bun (native TUI tests)   | `1.4.3` (minimum `1.3.14`)      |

OpenCode supplies the SDK, theme and OpenTUI runtime. Development dependencies exist only for type checking and local tests. The plugin version and configuration schema version are independent.

## Features

- **Native registration**: providers, models, integrations and reasoning variants for three protocols.
- **Header injection**: merged at the model request, final HTTP request and experimental WebSocket handshake hooks.
- **Case-insensitive merge**: `User-Agent`, `user-agent` and `USER-AGENT` are one field; route headers win over automatic authentication headers.
- **Model catalog**: context window, maximum output, `text` / `image` input and OpenAI reasoning variants.
- **Discovery**: explicit endpoint listing, merged by model ID without erasing existing capabilities or limits.
- **Credential isolation**: each route owns the integration `llmapi-<route ID>`; save its key through `/connect`.
- **Reliable persistence**: strict schema validation, revision conflict detection, serialized writes and distinct feedback for "saved but refresh failed".
- **Terminal workflow**: route CRUD, discovery, refresh, full-JSON editing and a multiline editor.

The plugin performs no background polling and sends no telemetry. It contacts the configured model-listing endpoint only when the user explicitly runs **Discover models**.

## Install

### Prerequisites

1. OpenCode 2.4.1 installed; `opencode --version` works.
2. Node.js 22+ and npm for local development.
3. Bun 1.3.14+ for native TUI render checks; this project was verified with Bun 1.4.3.

### From source

```sh
cd /path/to/opencode-llmapi-custom-headers
npm ci
```

Edit `opencode.json` in the configuration directory reported by `opencode debug paths`. Add the package's **absolute directory** to `plugins` and keep existing entries:

```json
{
  "plugins": ["C:/plugins/opencode-llmapi-custom-headers"]
}
```

Use forward slashes on Windows. If the local setup loads the TUI explicitly through `cli.json`, add the same entry there in the **same configuration directory**:

```json
{
  "plugins": ["C:/plugins/opencode-llmapi-custom-headers"]
}
```

Restart OpenCode after saving. The host loads the TypeScript source directly; there is no frontend build. Confirm the plugin is listed:

```sh
opencode plugin list
```

To install a release archive, install the `.tgz` into a persistent directory first and point both configuration files at that directory. This project does not claim an existing public npm release.

For remote use, install the server plugin on the connected service and the TUI plugin on the terminal side, using the same plugin version. A terminal-only install cannot provide RPC.

## Quick start

1. Run `/llmapi-custom-headers` and choose **Add route**.
2. Enter a route ID, protocol, Base URL and model IDs (one per line or comma-separated, may be empty), then choose input types per model and supply headers JSON.
3. Run `/connect`, search for the route ID, select `LLM API Custom Headers · <route ID>` and choose **API key**.
4. Save the key. The plugin resolves the active credential of that integration at request time.
5. Run `/models` and select a model from the route.

Example headers:

```json
{
  "User-Agent": "my-opencode-client",
  "X-Application": "my-team"
}
```

Real model invocation is intentionally left to the operator; this build does not verify generation endpoints.

## Operations

The main menu offers:

- **Refresh**: reload host integration, provider and model caches without network access.
- **Discover models**: explicitly query the route's model-listing endpoint and merge results by ID after confirmation.
- **Edit route and models**: edit the route's full JSON in `api` → `baseURL` → `models` → `headers` order.
- **Add route**: step-by-step wizard that commits only at the final step.
- **Delete route**: remove configuration and retain saved API keys.
- **API keys**: show the `/connect` instruction.

Editor keys: `Enter` newline, `Tab` indent, `Ctrl+A` select all, `Ctrl+S` save, `Esc` back. Navigation returns editor → routes → main menu → close. Returning inside the wizard retains confirmed fields and drafts.

## Configuration

The editor accepts one route object:

```json
{
  "api": "openai-completions",
  "baseURL": "https://gateway.example/v1",
  "models": [
    {
      "id": "example-model",
      "contextWindow": 262144,
      "maxTokens": 32768,
      "input": ["text", "image"],
      "reasoningEfforts": { "low": "low", "high": "high" }
    }
  ],
  "headers": {
    "User-Agent": "codex_cli_rs/0.169.0-alpha.11.1",
    "originator": "codex_cli_rs"
  }
}
```

- `contextWindow` defaults to `262144` and `maxTokens` to `32768`; **adjust them to the real model**.
- `input` accepts `["text"]`, `["image"]` or `["text", "image"]`; it cannot be empty.
- `reasoningEfforts` maps OpenAI variant names to wire values; `null` means "do not override".
- `Content-Length`, `Transfer-Encoding`, `Expect` and `Upgrade` belong to the HTTP layer and are rejected.

See [Configuration](docs/CONFIGURATION.md) for the full schema and validation rules.

## Security

- OpenCode stores API keys; the plugin holds only an integration reference and resolves it per request.
- Header values may contain secrets. Redact exports, logs and issue reports.
- Discovery refuses redirects and caps requests at 30 seconds and 4 MiB.
- Endpoints may target localhost or internal networks. The plugin provides no network isolation or SSRF boundary; configure only trusted endpoints.
- This repository has no third-party security audit, SLA or production certification.

See [Security](SECURITY.md) and the [security model](docs/SECURITY.md).

## Troubleshooting

| Symptom                         | Action                                                                     |
| ------------------------------- | -------------------------------------------------------------------------- |
| Slash command missing           | Verify absolute paths in `opencode.json` / `cli.json`, then restart        |
| `/connect` cannot find a route  | Refresh from the main menu and search by route ID; restart if still absent |
| Empty model list                | Save models or run discovery; configure a credential if required           |
| `401` / `403`                   | Check the active key, Base URL and whether headers override authentication |
| `SAVE_CONFLICT`                 | Re-read configuration before retrying; do not force an overwrite           |
| Saved but refresh failed        | The write succeeded; run **Refresh** instead of adding the route again     |
| Configuration validation failed | Fix the named field; do not delete the host database                       |

See [Troubleshooting](docs/TROUBLESHOOTING.md) for diagnostics.

## Development

```sh
npm ci
npm run format
npm run verify          # formatting, strict TypeScript and logic tests
npm run test:tui        # native editor render and key interaction (requires Bun)
npm run check:package   # versions, lockfile, exports and package allowlist
npm run verify:release  # complete release gate
```

`npm pack` runs `verify:release` through `prepack`. `npm run test:host` performs model generation calls and is **not part of this adaptation's default verification**; run it only against an isolated service with explicit authorization.

Verified scope and open acceptance items are recorded in [Validation and compatibility](docs/VALIDATION.md).

## Documentation

| Document                                       | Contents                                               |
| ---------------------------------------------- | ------------------------------------------------------ |
| [Documentation index](docs/README.md)          | Reading paths for the full documentation set           |
| [Installation](docs/INSTALLATION.md)           | Source and archive installs, upgrades, rollback        |
| [Configuration](docs/CONFIGURATION.md)         | Schema, route fields, headers, credentials, discovery  |
| [Architecture](docs/ARCHITECTURE.md)           | Module boundaries, lifecycle, data flow, failure modes |
| [Development](docs/DEVELOPMENT.md)             | Environment, scripts, constraints, test strategy       |
| [Operations](docs/OPERATIONS.md)               | Release gate, backup, recovery, support boundaries     |
| [Troubleshooting](docs/TROUBLESHOOTING.md)     | Symptoms, diagnostics, remediation                     |
| [Validation](docs/VALIDATION.md)               | Compatibility matrix, verified scope, acceptance list  |
| [Releasing](docs/RELEASING.md)                 | Version policy, artifacts, checklist                   |
| [Dependency review](docs/DEPENDENCY-REVIEW.md) | Dependency policy, audit, local hardening              |
| [Migration](docs/MIGRATION.md)                 | Legacy DSH configuration and removed fields            |
| [Security model](docs/SECURITY.md)             | Trust boundaries, threats, reporting                   |
| [Changelog](CHANGELOG.md)                      | Date-based changes within the same version             |
| [Contributing](CONTRIBUTING.md)                | Submission and review requirements                     |

## License

[MIT](LICENSE)
