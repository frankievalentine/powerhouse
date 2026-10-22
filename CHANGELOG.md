# Changelog

What changed in each powerhouse release. Updates follow these releases: Deploy to Cloudflare copies get a pull request from the Update powerhouse workflow, and clones update with `node setup.mjs --update`. Every release keeps working with data saved by earlier versions.

## Unreleased

### Added

- Remove powerhouse: `node setup.mjs --remove`, and a guide in the README for removing it by hand.

### Changed

- The README lays out Finish setup's steps, and Finish setup ends with a short checklist of what is left, each with its own button.

## 1.0.0 (2026-10-22)

### Added

- Finish setup: a deployment made with Deploy to Cloudflare sets itself up in the browser (Cloudflare Access, who can sign in, AI models, tools).
- Updates: the Update powerhouse workflow for Deploy to Cloudflare copies, `node setup.mjs --update` for clones, and Settings > Status says when a newer release is out.
- First-run suggestions for every role, which adapt to the tools that are on and to your website.
- A Website setting; jobs know it.
- Settings > Tools explains how to turn on each tool that is off; the "... is off" line opens it.
- Admins and members, dark theme, the orb favicon and notification icon.

## 0.1.0

The first version deployed with `node setup.mjs`.
