# NPM Token Setup for CI/CD

This guide explains how to safely configure the NPM authentication token for automated publishing.

## Overview

GitHub Actions workflows in this repo need an NPM token to publish packages to the npm registry (including the fixed-player static publisher in `.github/workflows/publish-fixed-player-static.yml`). This token must be:
- An **Automation token** (not granular or classic)
- Have **publish permissions** to the `@pie-framework` organization
- Stored securely as a GitHub **repository secret**

## Step-by-Step Setup

### 1. Generate an NPM Automation Token

1. **Log in to npmjs.com**
   - Go to https://www.npmjs.com
   - Sign in with your account that has publish access to `@pie-framework`

2. **Navigate to Access Tokens**
   - Click your profile picture (top right) → "Access Tokens"
   - Or go directly to: https://www.npmjs.com/settings/YOUR_USERNAME/tokens

3. **Generate New Token**
   - Click "Generate New Token" → "Classic Token"
   - **Select "Automation"** (this is critical for CI/CD)
   - Give it a descriptive name: `pie-players-github-actions`
   - Click "Generate Token"

4. **Copy the Token**
   - Copy the token immediately (you won't see it again!)
   - It looks like: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Verify Organization Permissions

Before adding the token, ensure your npm account has the right permissions:

```bash
# Check your membership in @pie-framework
npm org ls pie-framework

# You should see your username with "developer" or "owner" role
# If not, contact the org owner to add you
```

### 3. Add Token to GitHub Repository Secrets

#### When the repository is published to GitHub:

1. **Navigate to Repository Settings**
   - Go to: `https://github.com/pie-framework/pie-players/settings/secrets/actions`
   - Or: Repository → Settings → Secrets and variables → Actions

2. **Create New Repository Secret**
   - Click "New repository secret"
   - **Name**: `NPM_TOKEN` (must be exactly this)
   - **Value**: Paste your npm automation token
   - Click "Add secret"

3. **Verify the Secret**
   - You should see `NPM_TOKEN` listed under "Repository secrets"
   - The value will be hidden (shows as `***`)

### 4. Test the Setup (Optional but Recommended)

Before relying on automated publishing, test that the token works:

#### Local Test

```bash
# Set the token temporarily (don't commit this!)
export NPM_TOKEN="npm_your_token_here"

# Test authentication
npm whoami --registry=https://registry.npmjs.org/

# Should print your npm username
```

#### CI Test

Create a test changeset and push to a feature branch:

```bash
# Create a test changeset
bun run changeset
# Select a package, choose "patch", add message "test: verify npm token"

git add .changeset/
git commit -m "test: verify CI/CD setup"
git push origin feature/test-cicd
```

Then:
1. Create a PR from this branch
2. Check that CI runs successfully
3. **Do not merge** - this is just a test
4. Delete the branch and changeset

## Security Best Practices

### ✅ DO:

- Use **Automation tokens** for CI/CD (not Classic or Granular)
- Store tokens in **GitHub Secrets** only (never in code)
- Use descriptive token names to track where they're used
- Rotate tokens periodically (every 90-180 days)
- Limit token permissions to only what's needed

### ❌ DON'T:

- Never commit tokens to the repository
- Never put tokens in `.env` files that get committed
- Don't share tokens between different projects
- Don't use your personal Classic token in CI
- Don't store tokens in CI logs or artifacts

## Token Types Explained

NPM offers three token types:

| Type | Use Case | For CI/CD? |
|------|----------|-----------|
| **Automation** | CI/CD pipelines, automation scripts | ✅ Yes - Use this |
| Classic | CLI usage, personal workflows | ❌ No - Less secure |
| Granular | Fine-grained permissions (beta) | ⚠️ Maybe - Not widely supported yet |

**Why Automation tokens?**
- Can't be used to change user settings
- Can't perform two-factor auth operations
- Designed specifically for automated systems
- More secure for CI/CD environments

## Troubleshooting

### Error: "401 Unauthorized"

**Cause**: Token is invalid or expired

**Solutions**:
1. Verify the token is copied correctly (no extra spaces)
2. Check the token hasn't been revoked on npmjs.com
3. Ensure you used an Automation token, not Classic
4. Regenerate the token and update the GitHub secret

### Error: "403 Forbidden - you do not have permission to publish"

**Cause**: Your npm account lacks publish permissions to `@pie-framework`

**Solutions**:
1. Check your org membership: `npm org ls pie-framework`
2. Request "developer" or "owner" role from org admin
3. Verify the org allows publishing (some orgs restrict this)

### Error: "Package already exists"

**Cause**: Trying to publish a version that already exists

**Solutions**:
1. Create a changeset to bump the version
2. Ensure `bun run version` was executed
3. Check that package.json version is incremented

### CI doesn't publish after merging "Version Packages" PR

**Cause**: Multiple possible issues

**Solutions**:
1. Check that `NPM_TOKEN` secret is set in GitHub
2. Verify the release workflow has `id-token: write` permission
3. Check workflow logs for specific error messages
4. Ensure packages have `"private": false` (or no private field)

## Rotating the Token

It's good practice to rotate tokens periodically:

1. **Generate a new token** on npmjs.com (same steps as above)
2. **Update GitHub secret** with new token value
3. **Revoke old token** on npmjs.com
4. **Test** by running a patch release

## Emergency: Token Compromised

If a token is accidentally exposed (committed to git, posted publicly, etc.):

1. **Immediately revoke it** on npmjs.com
2. Generate a new token
3. Update GitHub secret with new token
4. If code was pushed, rewrite git history or rotate all credentials
5. Review recent npm publishes for unauthorized packages

## Alternative: Using .npmrc (Not Recommended for CI)

While you _could_ use an `.npmrc` file:

```ini
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

**This is NOT recommended** because:
- Risk of accidentally committing the token
- Harder to rotate across projects
- Less secure than GitHub Secrets

GitHub Secrets are the preferred approach.

## Verifying the Setup Works

After configuring everything, the full workflow is:

1. **Make changes** to packages
2. **Create changeset**: `bun run changeset`
3. **Commit and push** to feature branch
4. **CI runs** on PR (lint, build, test)
5. **Merge PR** to master
6. **Release workflow** detects changesets
7. **Workflow creates** "Version Packages" PR
8. **Review and merge** Version Packages PR
9. **Workflow publishes** to npm using `NPM_TOKEN`
10. **Packages appear** on npmjs.com

You can verify by checking:
- https://www.npmjs.com/package/@pie-framework/pie-iife-player
- https://www.npmjs.com/package/@pie-framework/pie-esm-player

## Questions?

If you encounter issues:
1. Check workflow logs in GitHub Actions
2. Review npm token permissions on npmjs.com
3. Verify organization membership and roles
4. Ensure packages are building successfully locally first

## Summary Checklist

Before publishing for the first time:

- [ ] Generate NPM Automation token
- [ ] Verify npm org permissions (`npm org ls pie-framework`)
- [ ] Push repository to GitHub
- [ ] Add `NPM_TOKEN` to GitHub repository secrets
- [ ] Test CI runs on a feature branch
- [ ] Create initial changeset
- [ ] Verify GitHub Actions has correct permissions
- [ ] Test full release flow with a patch version
- [ ] Document the token location for team (not the value!)
- [ ] Set calendar reminder to rotate token in 90 days
