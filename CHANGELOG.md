# Changelog

What changed in each powerhouse release. Updates follow these releases: Deploy to Cloudflare copies get a pull request from the Update powerhouse workflow, and clones update with `node setup.mjs --update`. Every release keeps working with data saved by earlier versions.

## Unreleased

### Added

- Team memory: notes every job can look up (decisions, contacts, product facts, preferences). Jobs search them and start with the ones that match; when you tell a job something worth keeping, it proposes a note, and an admin approves, edits or rejects it in Settings > Team memory. The header shows how many wait for review.
- Concise answers, on by default (Settings > Jobs): answers lead with the result in a few short lines. Adapted from the MIT-licensed i-have-adhd output style.
- Documents show as cards in the job window: rendered, with Open (a wide reader), Copy and Download .md. Code blocks get a header with Copy, long answers collapse, and tables render.
- Long jobs summarize their older steps instead of running out of context, with the cost counted in the job. The transcript marks where.
- Scheduled runs know what the schedule's last run reported, so a digest can say what is new.
- Voice, off until an admin turns it on in Settings > Jobs: a microphone in the composer (the Agents SDK's voice input, Deepgram Nova 3 on Workers AI) shows your words as you speak and puts them in the box to edit, and finished answers can be read aloud (Deepgram Aura 1). Billed per use; on Workers Free it shares the free daily Workers AI units with routing.
- Attach files to a job: PDFs, Word and Excel documents, CSVs and text files, up to 5 of 5 MB each, from the composer's paperclip or by dropping them. They become text through Workers AI Markdown Conversion; only the text is kept, and it is deleted with the job's history.
- Use from other apps (MCP): members start jobs and read their results from Claude, ChatGPT or Cursor at `https://<your powerhouse>/mcp`, after allowing the app in powerhouse. Off until an admin turns it on in Settings; setup adds the Access bypass it needs. Deployments set up before it add it once: rerun setup, or, for Deploy to Cloudflare copies, paste a one-time token in Settings > Use from other apps. Jobs show which app started them, members remove their apps in Settings, and admins can disconnect a member's apps.
- Per-member budgets: jobs tell the AI Gateway who started them (`member`), plus the role and run, so a spend limit split by `member` gives each member their own budget. A member who reaches theirs gets a clear message, and it no longer marks the model as needing attention for everyone.
- GitHub connection: Settings > Connections creates a private GitHub App for your org in one click (GitHub's manifest flow), limited to the repositories you choose and to contents, issues and pull requests. Other servers without automatic registration take an OAuth app's client ID and secret.

### Fixed

- A role's suggestion on the home page goes to that role instead of through routing.
- After a deploy or restart, a job that was being routed is routed again, an approved email or connection write is never repeated, and the job says it resumed.

### Changed

- The Worker is about 300 KB smaller (gzipped), leaving more room under the Workers Free limit.
- Built on Agents SDK 0.30 and Think 0.21: a job turn that keeps hitting the memory limit stops after five attempts instead of retrying forever.

## 1.0.1 (2026-10-22)

### Added

- Remove powerhouse: `node setup.mjs --remove`, and a guide in the README for removing it by hand.
- Finish setup asks for your GitHub repository and links straight to adding the update workflow and to the setting that lets it open pull requests. Settings > Organization keeps the repository.

### Fixed

- Updates for Deploy to Cloudflare copies: the copy does not receive workflow files, so copies now add a short workflow that calls powerhouse's own update workflow.

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
