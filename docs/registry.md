# Registry Contracts

## Tool manifests

Tool manifests define:

- identity and user-facing description
- supported platforms
- a `checkCommand` for doctor and idempotency
- one or more install steps per platform

Supported install step types in v1:

- `brew`
- `npm`
- `script`

The CLI exposes this catalog directly through:

- `powerhouse tool list`
- `powerhouse tool show <id>`
- `powerhouse registry scaffold-tool <id>`

## Profiles

Profiles provide the base workstation bundle:

- default tools
- default target agents for skills installation
- supported platforms
- notes

The CLI can scaffold a starter profile manifest with:

- `powerhouse registry scaffold-profile <id>`

## Domains

Domains augment profiles with:

- optional extra tools
- curated skill packages and skill names
- notes that explain the intent of the domain

The CLI can scaffold a starter domain manifest with:

- `powerhouse registry scaffold-domain <id>`
