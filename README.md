# powerhouse

`powerhouse` bootstraps AI-native development environments from a curated registry of tools, profiles, and domains.

It is designed for people who want a repeatable way to set up an agent-friendly machine without hard-coding one giant shell script for every possible workflow. Instead of maintaining separate install docs for every stack, `powerhouse` resolves a plan from manifests, installs what is missing, and records enough state to explain what happened later.

## What It Does

- Boots a machine from a selected profile and domain.
- Installs developer tools through manifest-defined backends.
- Adds curated agent skills for the target workflow.
- Persists active state and last-run metadata for `status`, `doctor`, and `update`.
- Ships a docs site and a local CLI from the same monorepo.

## Why The Project Exists

Most machine setup flows break down in one of two ways:

- They are simple, but too rigid to adapt to different agents or domains.
- They are flexible, but spread across shell scripts, dotfiles, wiki pages, and tribal knowledge.

`powerhouse` takes a middle path:

- Profiles define the base workstation shape.
- Domains layer on workflow-specific skill packages.
- Tool manifests declare how to check and install each dependency.
- The CLI stays small and inspectable so you can see the resolved plan before anything mutates your machine.

## Current Scope

Version `0.1.0` currently targets:

- macOS
- Linux

The v1 implementation is intentionally CLI-first. GUI setup flows, plugin installers, MCP installers, and config symlink management are out of scope for now.

## How Bootstrap Works

The default entrypoint is [`install.sh`](./install.sh).

High-level flow:

1. Detect the platform and run platform-specific preflight checks.
2. Install Homebrew if it is missing.
3. Install Bun if it is missing.
4. Install workspace dependencies for the local `powerhouse` repo.
5. Install the `powerhouse` command wrapper.
6. Hand off to the Bun-powered CLI.
7. Resolve the selected profile and domain into a concrete install plan.
8. Install missing tools.
9. Install curated skills for the selected agent targets.
10. Save state and the last-run report for later inspection.

If you want to inspect the plan without changing the machine, use `plan` or `bootstrap --dry-run`.

## Repository Layout

- [`install.sh`](./install.sh): bootstrap entrypoint for end-user setup.
- [`packages/cli`](./packages/cli): the `powerhouse` command surface and interactive UX.
- [`packages/core`](./packages/core): registry loading, plan resolution, installers, doctor checks, status reporting, and state persistence.
- [`registry`](./registry): source-of-truth manifests for tools, profiles, and domains.
- [`apps/web`](./apps/web): Astro/Starlight docs site.
- [`docs`](./docs): architecture and registry notes for contributors.
- [`tests`](./tests): Vitest coverage for core resolution and state flows.
- [`Brewfile`](./Brewfile): contributor dependencies for working on this repository.

## Profiles, Domains, And Tools

The registry is the core abstraction in this project.

### Profiles

Profiles define the base machine bundle:

- default tools
- default agent targets
- supported platforms
- notes about the intended workflow

Current profiles include:

- `claude-dev`
- `codex-dev`
- `local-models`

### Domains

Domains extend a profile with workflow-specific skill packages and guidance.

Current domains include:

- `general`
- `backend`
- `web`

### Tools

Tool manifests define:

- identity and description
- supported platforms
- a `checkCommand` used for doctor/idempotency
- one or more install steps per platform

Supported install backends in v1:

- `brew`
- `npm`
- `script`

## Quick Start

### End-user bootstrap

Run the bootstrap script:

```bash
./install.sh
```

For a non-mutating preview:

```bash
./install.sh --dry-run
```

### Contributor setup

Install dependencies for this repository:

```bash
bun install
```

If you use Homebrew locally, the committed [`Brewfile`](./Brewfile) can help install contributor tooling. It is not the end-user install contract; the registry manifests are.

## Local Development

Common commands:

```bash
bun run cli --help
bun run bootstrap --dry-run
bun run doctor
bun run cli status
bun run cli plan --profile claude-dev --domain web --platform darwin
bun run cli profile list
bun run cli domain list
bun run cli tool list
bun run cli registry validate
bun run cli skills find typescript
bun run test
bun run typecheck
bun run web:dev
```

## CLI Overview

The current command surface is:

- `bootstrap`: resolve and apply a full install plan from a profile + domain.
- `doctor`: check the current environment and saved state.
- `status`: summarize platform info, active selection, last run, and doctor results.
- `plan`: resolve a plan without installing anything.
- `skills`: list, find, install, remove, or update skills via the upstream skills CLI.
- `profile`: inspect available profiles.
- `domain`: inspect available domains.
- `tool`: inspect available tools.
- `registry`: validate registry consistency.
- `update`: sync the workspace, refresh dependencies, and update the active setup.

Example plan inspection:

```bash
bun run cli plan --profile claude-dev --domain web --platform darwin
```

Example bootstrap:

```bash
bun run cli bootstrap --profile codex-dev --domain general --yes
```

## State And Diagnostics

`powerhouse` stores machine state and run metadata in XDG-style directories under the current platform:

- config: `.../powerhouse`
- cache: `.../powerhouse`
- state: `.../powerhouse`

The state layer currently persists:

- the active profile
- the active domain
- installed tool ids
- installed agent targets
- platform metadata
- the most recent run report, including failures

This gives `status`, `doctor`, and `update` enough context to explain what is healthy, what changed, and where a bootstrap failed.

## Docs

The web/docs workspace lives in [`apps/web`](./apps/web) and uses Astro with Starlight.

Run it locally with:

```bash
bun run web:dev
```

## Testing And Validation

Before pushing changes, the baseline checks are:

```bash
bun run test
bun run typecheck
bun run cli registry validate
```

## Known Boundaries

- macOS and Linux only
- No WSL2 support yet
- No GUI installer path
- No plugin or MCP installer flow yet
- No config symlink management yet

## Additional Project Notes

- [`docs/architecture.md`](./docs/architecture.md) outlines the main system split.
- [`docs/registry.md`](./docs/registry.md) describes the registry contract.
- The contributor `Brewfile` is intentionally separate from end-user install logic.
