# Registry Contracts

## Integrations

Integration manifests define curated agent plugins and extensions with:

- target agent
- supported platforms and normalized scopes
- install strategy using `native-cli`, `json-config`, `toml-config`, or `manual`
- optional bundled MCP server ids

The CLI exposes this catalog directly through:

- `powerhouse integration list`
- `powerhouse integration find [query]`
- `powerhouse integration show <id>`
- `powerhouse integration install <id>`
- `powerhouse registry scaffold-integration <id>`

## MCP servers

MCP manifests define curated server setups with:

- target agents
- server kind and source
- supported platforms and normalized scopes
- install strategy using `native-cli`, `json-config`, `toml-config`, or `manual`

The CLI exposes this catalog directly through:

- `powerhouse mcp list`
- `powerhouse mcp find [query]`
- `powerhouse mcp show <id>`
- `powerhouse mcp install <id>`
- `powerhouse registry scaffold-mcp <id>`

## Tool manifests

Tool manifests define:

- identity and user-facing description
- supported platforms
- a typed `check` command spec for doctor and idempotency
- one or more install steps per platform

Supported install step types in v1:

- `brew`
- `npm`
- `script`
- `winget`
- `powershell-script`
- `scoop`

The CLI exposes this catalog directly through:

- `powerhouse tool list`
- `powerhouse tool show <id>`
- `powerhouse registry scaffold-tool <id>`

## Profiles

Profiles provide the base workstation bundle:

- default tools
- optional default integrations and MCP servers
- default target agents for skills installation
- supported platforms
- notes

The CLI can scaffold a starter profile manifest with:

- `powerhouse registry scaffold-profile <id>`

## Domains

Domains augment profiles with:

- optional extra tools
- optional integrations and MCP servers
- curated skill packages and skill names
- notes that explain the intent of the domain

The CLI can scaffold a starter domain manifest with:

- `powerhouse registry scaffold-domain <id>`
