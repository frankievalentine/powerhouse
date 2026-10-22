/**
 * Deploy to Cloudflare copies powerhouse into the person's GitHub account
 * without its workflow files, so a copy adds this short workflow once (Finish
 * setup links to GitHub's editor with it filled in). It calls powerhouse's
 * own update workflow (.github/workflows/update.yml), so improvements to
 * updating reach every copy without anyone editing this file.
 */
export const UPDATE_WORKFLOW_PATH = ".github/workflows/update-powerhouse.yml";

export const UPDATE_WORKFLOW = `# Keeps this copy of powerhouse up to date: once a week, or when you run it
# from the Actions tab, it opens a pull request when a new release is out.
# Merging the pull request redeploys powerhouse.
name: Update powerhouse

on:
  schedule:
    - cron: "17 9 * * 1"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  update:
    uses: frankievalentine/powerhouse/.github/workflows/update.yml@main
`;

/** "owner/name", as GitHub shows it. */
export function isRepoSlug(value: string) {
  return /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(value);
}

/** Opens GitHub's editor on the copy's default branch with the workflow filled in; one click commits it. */
export function addUpdateWorkflowUrl(repository: string, branch = "main") {
  const params = new URLSearchParams({ filename: UPDATE_WORKFLOW_PATH, value: UPDATE_WORKFLOW });
  return `https://github.com/${repository}/new/${branch}?${params.toString()}`;
}

/** Where "Allow GitHub Actions to create and approve pull requests" lives. */
export function actionsSettingsUrl(repository: string) {
  return `https://github.com/${repository}/settings/actions`;
}

/** Open update pull requests in the copy. */
export function updatePullRequestsUrl(repository: string) {
  return `https://github.com/${repository}/pulls?q=${encodeURIComponent("is:pr is:open Update powerhouse")}`;
}
