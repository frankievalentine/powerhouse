---
description: Deploy preview environments for pull requests using Vercel
---

# Deploy Preview Workflow

Follow these steps to set up and use preview deployments for PRs.

## Step 1: Prerequisites

Ensure you have:

- Vercel account linked to your GitHub repository
- `VERCEL_TOKEN` secret in GitHub repository settings
- `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from Vercel project settings

### Get Vercel IDs

```bash
# Install Vercel CLI
npm install -g vercel

# Link project (creates .vercel/project.json)
vercel link

# Get IDs from .vercel/project.json
cat .vercel/project.json
```

## Step 2: Create GitHub Action

Create `.github/workflows/preview.yml`:

```yaml
name: Preview Deployment

on:
  pull_request:
    types: [opened, synchronize, reopened]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install Dependencies
        run: npm ci

      - name: Install Vercel CLI
        run: npm install -g vercel@latest

      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project
        run: vercel build --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel
        id: deploy
        run: |
          url=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
          echo "url=$url" >> $GITHUB_OUTPUT

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const url = '${{ steps.deploy.outputs.url }}';
            const sha = context.sha.substring(0, 7);

            // Find existing comment
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });

            const botComment = comments.find(c => 
              c.user.login === 'github-actions[bot]' && 
              c.body.includes('🚀 Preview Deployment')
            );

            const body = `## 🚀 Preview Deployment

            | Status | URL | Commit |
            |--------|-----|--------|
            | ✅ Ready | [Preview](${url}) | \`${sha}\` |

            > This preview will be updated with each push to this PR.`;

            if (botComment) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: botComment.id,
                body: body
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: body
              });
            }
```

## Step 3: Add Secrets to GitHub

Go to repository Settings → Secrets and variables → Actions:

1. Add `VERCEL_TOKEN` - Your Vercel personal access token
2. Add `VERCEL_ORG_ID` - From .vercel/project.json
3. Add `VERCEL_PROJECT_ID` - From .vercel/project.json

## Step 4: Create PR

```bash
# Create branch and make changes
git checkout -b feature/my-feature

# Make your changes...
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push -u origin feature/my-feature
gh pr create --fill
```

## Step 5: Monitor Deployment

```bash
# View workflow status
gh run list

# Watch current run
gh run watch

# View deployment logs
gh run view --log
```

## Step 6: Test Preview

Once deployed, the PR will have a comment with the preview URL:

1. Click the preview link in the PR comment
2. Test the feature in the preview environment
3. Share link with reviewers for testing

## Step 7: Cleanup (Automatic)

When the PR is merged or closed, Vercel automatically:

- Removes the preview deployment
- Frees up resources

## Alternative: Direct Vercel Integration

If you prefer automatic deployments via Vercel's GitHub integration:

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure build settings
4. Every PR automatically gets a preview deployment

## Environment Variables

For different environments, set up in Vercel dashboard:

- **Production**: Used for `main` branch
- **Preview**: Used for PR deployments
- **Development**: For local development

```bash
# Pull environment variables locally
vercel env pull .env.local
```

## Checklist

- [ ] Vercel project linked
- [ ] GitHub secrets configured
- [ ] Workflow file created
- [ ] PR created to test
- [ ] Preview URL accessible
- [ ] PR comment shows status
- [ ] Environment variables set
