# CrownKeep Web Gateway

This service is the narrow network boundary for CrownKeep's provider-neutral
`Web Search` and `Web Read` tools. It is **not** an AI/model endpoint.

## Privacy contract

The client sends only:

- `POST /api/web/search` — `{ "query": "...", "maxResults": 5 }`
- `POST /api/web/read` — `{ "url": "https://..." }`

The gateway does not require or accept conversation history, projects, files,
images, local knowledge, or model prompts. CrownKeep's local model remains the
reasoning provider.

## First provider adapter

The initial adapter uses Tavily Search and Extract. `TAVILY_API_KEY` exists
only in the Function App environment; it must never be placed in Vite/client
configuration.

Search uses basic depth without provider-generated answers or raw page content.
Read uses the separate Extract endpoint only for the selected URL.

## Local run

1. Copy `local.settings.example.json` to `local.settings.json`.
2. Put a Tavily key in the local-only file.
3. From this directory, run `func start`.
4. Configure the CrownKeep client with:
   `VITE_CROWNKEEP_WEB_GATEWAY_URL=http://localhost:7071/api/web`

`local.settings.json` is intentionally not committed.

## Azure prototype deployment

Deploy this folder to a Python Azure Functions app and set:

- `TAVILY_API_KEY` — secret application setting
- `CROWNKEEP_WEB_ALLOWED_ORIGIN` — `*` for the early native-client prototype,
  or a specific browser origin when applicable

Then build CrownKeep with:

`VITE_CROWNKEEP_WEB_GATEWAY_URL=https://<function-host>/api/web`

The anonymous HTTP surface is intentionally limited to two read-only public-web
operations. Before broad/public distribution, place normal gateway protections
(rate limiting/abuse controls and appropriate origin policy) in front of it.

## Provider replacement

Keep the JSON contract above stable. A future search provider can replace
Tavily inside this service without changing ToolRegistry, Anne, Windows model
selection, Apple Foundation Models, or the CrownKeep UI.
