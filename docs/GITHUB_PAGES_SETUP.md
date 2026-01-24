# GitHub Pages Deployment Setup

Complete guide for deploying the PIE Players **docs/front** site and the **examples** sub-site to GitHub Pages.

## Overview

This repo deploys a single GitHub Pages site:

- **Docs (front)**: `https://<org>.github.io/pie-players/`
- **Examples (sub-site)**: `https://<org>.github.io/pie-players/examples/`

Deployment runs automatically on pushes to the `master` branch via GitHub Actions.

## Prerequisites

### 1. GitHub Repository Setup

The repository must be hosted on GitHub (likely at `pie-framework/pie-players`).

```bash
# If not already set up, add the remote:
git remote add origin git@github.com:pie-framework/pie-players.git
git push -u origin master
```

### 2. Enable GitHub Pages

1. Go to repository Settings → Pages
2. Under "Build and deployment":
   - **Source**: GitHub Actions (not "Deploy from a branch")
3. Click Save

**Important**: GitHub Pages must use "GitHub Actions" as the source, not the legacy "Deploy from a branch" method.

## Configuration Files

### 1. GitHub Actions Workflow

**File**: `.github/workflows/pages.yml`

This workflow:
- Triggers on pushes to `master` that affect the docs app, examples app, or packages
- Can be manually triggered via `workflow_dispatch`
- Builds all packages, then builds both SvelteKit apps as static sites
- Merges them into a single Pages artifact:
  - `site/` = docs build output
  - `site/examples/` = examples build output
- Uploads and deploys to GitHub Pages

**Key features**:
- Uses `@sveltejs/adapter-static` to build a static site
- Configures base paths for project pages hosting
- Only deploys when relevant files change
- Allows manual deployment for testing

### 2. SvelteKit Configuration

**Docs**: `apps/docs/svelte.config.js`

The docs app is hosted at the root:

- Production base: `/pie-players`

**Examples**: `apps/example/svelte.config.js`

The examples app is hosted under a subpath:

- Production base: `/pie-players/examples`

```javascript
import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      precompress: false,
      strict: false
    }),
    paths: {
      // GitHub Pages uses /<repo-name> as base path
      base: process.env.NODE_ENV === 'production' ? '/pie-players/examples' : ''
    }
  }
};
```

**What this does**:
- Uses `adapter-static` to prerender all pages
- Sets `base` path to `/pie-players/examples` for the examples app in production
- Keeps base path empty for local development
- Outputs to `build/` directory

### 3. Package Dependencies

**Required**: `@sveltejs/adapter-static` (already installed)

```bash
cd apps/example
bun add -D @sveltejs/adapter-static
```

## Deployment Process

### Automatic Deployment

When you push to `master` with changes to:
- `apps/docs/**`
- `apps/example/**`
- `packages/**`
- `.github/workflows/pages.yml`

The workflow will:
1. ✅ Install dependencies
2. ✅ Build all packages
3. ✅ Build docs + examples as static sites
4. ✅ Assemble a single Pages artifact (docs root + examples subdir)
5. ✅ Upload build artifact
6. ✅ Deploy to GitHub Pages

**Build time**: ~2-3 minutes

**Deployment URL**:
- Docs: `https://<org>.github.io/pie-players/`
- Examples: `https://<org>.github.io/pie-players/examples/`

### Manual Deployment

You can manually trigger deployment:

1. Go to Actions → Deploy Docs + Examples to GitHub Pages
2. Click "Run workflow"
3. Select branch (usually `master`)
4. Click "Run workflow"

This is useful for:
- Testing the deployment process
- Deploying without code changes
- Re-deploying after Pages configuration changes

## Local Testing with Production Build

To test the production build locally:

```bash
# Build packages + both sites with production base paths
bun run build:pages
```

This produces:

- `apps/docs/build` (docs site)
- `apps/example/build` (examples site)

## Troubleshooting

### Issue: 404 on GitHub Pages

**Symptoms**: Site deploys but shows 404 or blank page

**Solutions**:
1. Check that GitHub Pages source is set to "GitHub Actions" (not branch)
2. Verify the base path matches the repo name in `svelte.config.js`
3. Check build logs for prerendering errors
4. Ensure all routes are prerenderable (no dynamic params without prerender)

### Issue: Assets Not Loading

**Symptoms**: HTML loads but CSS/JS 404s

**Solutions**:
1. Verify `base` path in `svelte.config.js` matches repo name
2. Check that `NODE_ENV=production` is set during build
3. Use `<base href="...">` tag if needed (SvelteKit handles this automatically)

### Issue: Workflow Not Triggering

**Symptoms**: Push to master but no deployment

**Solutions**:
1. Check if changed files match the `paths` filter in workflow
2. Verify workflow file is on `master` branch
3. Check Actions tab for workflow run (may have failed)
4. Ensure GitHub Actions are enabled for the repository

### Issue: Build Fails in CI

**Symptoms**: Workflow runs but build step fails

**Solutions**:
1. Run `bun run build` locally to reproduce
2. Check for type errors or build warnings
3. Verify all dependencies are in package.json (not just devDependencies)
4. Check build logs for specific error messages

## Verifying Deployment

After deployment completes:

1. ✅ Visit `https://<org>.github.io/pie-players/` (docs)
2. ✅ Click “Examples” and verify it opens `.../pie-players/examples/`
3. ✅ Navigate within examples (Samples, Playground, Authoring, etc.)
4. ✅ Verify assets load (no 404s in Network tab)

## Updating Base Path

If the repository is renamed or hosted under a different org:

1. Update `svelte.config.js`:
```javascript
base: process.env.NODE_ENV === 'production' ? '/new-repo-name' : ''
```

2. Rebuild and redeploy:
```bash
bun run build
git add .
git commit -m "chore: update GitHub Pages base path"
git push
```

## Deployment Status Badge

Add this badge to your README to show deployment status:

```markdown
[![Deploy Pages](https://github.com/pie-framework/pie-players/actions/workflows/pages.yml/badge.svg)](https://github.com/pie-framework/pie-players/actions/workflows/pages.yml)
```

## Next Steps

After first deployment:

1. ✅ Verify deployment at GitHub Pages URL
2. ✅ Add deployment status badge to README
3. ✅ Update main documentation with live demo link
4. ✅ Share demo URL in release notes
5. ✅ Consider custom domain (optional)

## Custom Domain (Optional)

To use a custom domain like `demo.pie-framework.org`:

1. Add CNAME file:
```bash
echo "demo.pie-framework.org" > apps/example/static/CNAME
```

2. Update DNS records:
   - Add CNAME pointing to `<org>.github.io`
   - Or A records to GitHub Pages IPs

3. Configure in repository Settings → Pages → Custom domain

4. Update `svelte.config.js` base path:
```javascript
base: '' // No base path for custom domain
```

## Monitoring

Check deployment health:

- **Workflow runs**: Actions tab shows all deployments
- **Build logs**: Click on workflow run for detailed logs
- **Pages deployments**: Settings → Pages shows deployment history
- **Live site**: Visit URL to verify it's working

## Security

The workflow uses these permissions:
- `contents: read` - Read repository code
- `pages: write` - Deploy to GitHub Pages
- `id-token: write` - Authenticate deployment

These are minimal required permissions and follow least-privilege principle.

## See Also

- [WORKFLOW_STRATEGY.md](WORKFLOW_STRATEGY.md) - CI/CD + publishing workflow (Changesets)
- [docs-driven local evals](evals/README.md) - local-only, YAML-driven Playwright evals
- [CDN_USAGE.md](CDN_USAGE.md) - using the built web components via npm CDNs
