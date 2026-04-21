# Architecture

`powerhouse` is split into four working areas:

- Bootstrap shell: `install.sh` plus `scripts/platform/*` handle first-run preflight and Bun installation.
- CLI surface: `packages/cli` exposes the command model and interactive bootstrap UX.
- Core engine: `packages/core` loads registry manifests, resolves install plans, runs doctor checks, and executes backends.
- State model: `powerhouse` persists active selection state plus a last-run report so failed installs and updates can be diagnosed after the fact.
- Product registry: `registry/` contains the curated tools, profiles, and domains that define what gets installed.

The committed `Brewfile` is for contributors only. End-user installs are resolved from manifests and executed per-tool so casks, formulas, npm installs, and script installers can coexist cleanly.
