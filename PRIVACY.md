# Privacy

Codex Skin Studio has no server and sends no telemetry.

## Local data

The project stores local job copies, the written brief, `reference-analysis.json`, `skin-spec.json`, generated hero/icon assets, compiled bundles, hashes, progress state, and injector state. Codex credentials are never opened or copied.

## Data handled by local Codex

The desktop workflow launches the user's installed `codex` command under their existing authentication:

- Reference extraction attaches local job copies in an ephemeral, read-only structured-output task with user configuration disabled.
- Theme planning consumes the saved extraction plus the brief and does not attach the images again.
- Hero generation attaches the reference copies to Codex's built-in image-generation capability.
- Icon generation attaches the generated hero to keep the asset language consistent.

These requests may be transmitted to OpenAI according to the user's Codex account and workspace policy. No request is sent to a Codex Skin Studio service because no such service exists.

Structured analysis and planning stop on shell, MCP, web, browser, or HTTP tool events. Image-generation tasks run in a read-only sandbox; local read-only inspection is allowed for the image workflow, while MCP, web, browser, and HTTP tools remain blocked. Generated images are detected under the user's local Codex generated-image directory, validated, then copied into the isolated job.

## No fallback model

The application does not bundle a model, API key, third-party image service, or automatic local-model fallback. If the installed Codex image capability does not produce a valid asset, generation stops without applying a partial skin.

