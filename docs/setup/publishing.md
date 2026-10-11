# Releasing

This page is for maintainers: how the `@pie-players/*` packages are versioned,
gated and published to npm, and how to recover a release that failed partway.
What a version means for a host is in
[Versioning and stability](../install/versioning.md); the package list is in
[Publishable packages](./publishable_packages.md).

## Release sequence

CI is the release path. [Manual publishing (local)](#manual-publishing-local)
runs the same steps from a checkout.

1. Changes merge into `develop`, each with a `patch` changeset in
   `.changeset/`.
2. A promotion PR merges `develop` into `master`.
3. The push to `master` runs `.github/workflows/release.yml`. With changesets
   present, `changesets/action` runs `bun run version` and opens or updates the
   `chore(release): version packages [skip-heavy-ci]` PR. With neither
   changesets nor a version bump, the workflow first writes a temporary
   changeset declaring `patch` for every package
   (`scripts/create-temporary-release-changeset.mjs`), so the PR opens anyway.
   It writes none while npm does not yet have the current version, so a merge
   cannot stack a second bump on an unpublished release.
4. Merging the version PR pushes the version bump to `master`. The workflow
   builds, runs `check:custom-elements`, `check:fixed-versioning` and
   `bun run verify:publish`, resolves npm auth
   ([How CI authenticates to npm](#how-ci-authenticates-to-npm)), and publishes
   with `bun run release`.
5. After a publish, the workflow creates the GitHub Release `v<version>`, runs
   the [post-publish checks](#post-publish-checks), and opens a `master` →
   `develop` back-merge PR. Merge it
   ([Back-merge to develop](#back-merge-to-develop)).

`release.yml` runs only on `master` pushes that touch `.changeset/`,
`packages/`, `tools/`, `package.json`, `bun.lock`, `turbo.json`,
`tsconfig*.json` or the workflow file, so a docs-only merge releases nothing.
`@pie-players/pie-preloaded-player` has its own workflow and version scheme
([Preloaded player CI/CD](../../configs/preloaded-player/README.md#cicd)).

## Release labels

A release label is an annotated git tag on the current commit whose message
lists every public workspace package at its version. It marks a coordinated
release wave alongside the `v<version>` GitHub Release.

```bash
bun run release:label                # tag <checkout directory name>-YYYY.MM.DD
bun run release:label -- --label players-2026.02
bun run release:label -- --dry-run   # print the tag message, create nothing
bun run release:label:push           # create the tag and push it to origin
```

The default prefix is the checkout directory's name (`pie-players` in a
standard clone); `--prefix` replaces it. The script fails if the tag exists.

## Versioning policy

Every publishable package releases at one shared version. The Changesets
`fixed` block in [`.changeset/config.json`](../../.changeset/config.json)
defines the set: add a new publishable package to it in the same change, and
never remove one to unblock a release.

- Every release bumps every package in the set, including packages whose source
  did not change, so each version PR touches every manifest and changelog.
- On the pre-1.0 `0.x.y` line every release is a `patch` bump, breaking changes
  included; the changeset body documents the break.
  `check:changeset-patch-only` rejects any pending `minor` or `major`
  changeset. Only an explicit maintainer decision changes this policy.
- Source manifests keep internal dependencies as `workspace:*`. Publishing
  rewrites each to the exact version being released, then restores the
  manifests (`bun run restore:workspace-ranges`).
- `check:fixed-versioning` (`scripts/check-fixed-versioning.mjs`) fails when
  local versions diverge, when an internal dependency is not `workspace:*`, or
  when the local version would skip a patch version on npm.

## Required package metadata

Every non-private workspace package in `packages/*` declares:

- `publishConfig.access`: `public`
- `license`, `homepage`, and `bugs` (a URL string or an object with `url`)
- `repository.url` in the canonical
  `git+https://github.com/pie-framework/pie-players.git` form, and
  `repository.directory` matching the workspace location
- a non-empty `files`
- `exports`, or `main` and `types`
- `engines.node`
- an explicit `sideEffects`

`scripts/publish-policy.json` holds the policy and
`scripts/check-package-metadata.mjs` validates it.

## Publish gates

`bun run verify:publish` is the full gate. It builds first, CI runs it before
every publish, and the local publish runs it after the version bump. Run it
before opening or merging a release.

| Concern | Checks |
| --- | --- |
| Version policy | `check:changeset-patch-only`, `check:fixed-versioning` |
| Manifests and dependencies | `check:package-metadata`, `check:svelte-runtime-deps`, `check:ce-consumer-contract` (Svelte peer policy), `check:deps`, `check:undeclared-subpaths` (cross-package imports name declared exports), `check:math-rendering-version` (one `@pie-lib/math-rendering-module` version) |
| Custom elements | `check:custom-elements`, `check:custom-elements:dist`, `check:ce-define-safety` |
| Published surface | `check:publint`, `check:types-publish` (ATTW), `check:svelte-type-imports` (no declaration reaches `svelte`), `check:pack-integrity:real` (real tarballs) |
| Consumer boundaries | `check:consumer-boundaries` (app imports), `check:node-consumer-imports` (Node-safe entry points), `check:bundle-safety` (bundle shape, player and tool boundaries) |
| Toolkit core | `check:engine-core-purity`, `check:speech-composition-purity`, `check:capability-neutrality` |
| Scripts | `check:scripts` (unit tests for `scripts/`) |

`check:publish-surface` and `check:sourcemaps` run on their own. The dist-only
rules they enforce are in
[Library packaging strategy](./library-packaging-strategy.md#dist-only-publish-surface).

## Release intent in CI

A push to `master` takes one of two paths:

- **Version PR**: changesets are present, or there are neither changesets nor a
  version bump (the temporary changeset then covers every package).
- **Publish**: the push changes the `version` field of a non-private manifest
  under `packages/` or `tools/`, which merging the version PR does. Other
  manifest edits do not count.

A manual run (Actions → Release → Run workflow) states its intent:

| `release_intent` | Requires |
| --- | --- |
| `version-pr` (default) | at least one changeset in the commit |
| `publish` | a version bump, or `force_publish: true` |

`publish_auth` selects the npm auth mode
([Auth mode resolution](#auth-mode-resolution)).

### Manual publish recovery

If a publish failed for a transient reason (a registry outage, a network
failure) and the fixes are on `master`, rerun the workflow: Actions → Release →
Run workflow, branch `master`, `release_intent` `publish`, `force_publish`
`true`. `force_publish` skips only the version-bump detection; every gate still
runs, and a manual publish also runs `bun run test`.

### Partial publish

A run that loses npm auth partway leaves the registry split: the packages that
made it are at the version being released, the rest one patch behind.
Rerunning the manual publish repairs it, since `changeset publish` skips the
versions that already landed. `check:fixed-versioning` recognizes that one
split and reports it without failing:

```
[check-fixed-versioning] Completing a partial publish of x.y.z. 1 package(s) already
published it (@pie-players/pie-theme) and 39 are still one patch behind ...
```

Every other multi-version state stays fatal, because republishing does not
reconcile drift. Do not set `SKIP_NPM_VERSION_SEQUENCE_CHECK=1` to get past a
split: it also disables the patch-sequence and version-skip checks that stop a
release from skipping a version.

Do not unpublish the packages that succeeded. npm never accepts a version
number again once it is unpublished, so that version becomes unreachable for
the package and the whole group has to move forward.

## Back-merge to develop

The release commit exists only on `master`: `changesets/action` bumps the
manifests, writes the `CHANGELOG.md` entries and deletes the consumed
changesets there. After a publish, `release.yml` opens a `master` → `develop`
PR titled `chore(release): back-merge <version> into develop`. Merge it.

Until it merges, `develop` keeps the version of the previous back-merge.
`bootstrap-package` reads the group version from the branch it runs on, so a
package bootstrapped from that `develop` publishes below the group
([Bootstrap version](#bootstrap-version)).

The workflow opens a PR because the merge can conflict where `develop` and the
release both appended to a `CHANGELOG.md`: take both sides, release entry
first. The step is idempotent: it reuses an open back-merge PR, and skips when
`develop` already contains `master`. It cannot fail a release, and it runs
under `!cancelled()`, so a failing post-publish check fails the run without
skipping the back-merge.

## Post-publish checks

After a publish, `release.yml` verifies the registry:

- `scripts/check-published-closure.mjs` confirms that every published
  `@pie-players/*` package references only internal versions that resolve, and
  fails on a leaked `workspace:*` range.
- `scripts/check-provenance.mjs` confirms that every package carries a
  provenance attestation
  ([Verifying a release used OIDC](#verifying-a-release-used-oidc)). It is
  advisory on token runs.

### Registry propagation

Both checks read the registry in the job that just published to it, and npm
serves reads from replicas that lag the write.
`scripts/lib/registry-propagation.mjs` is their shared retry policy: five
attempts per lookup with exponential backoff from 3 s, under one 240 s deadline
for the whole run. Only E404 and ETARGET retry, so an authorization failure
fails at once.

The deadline is shared because versioning is fixed: a real partial release
fails every package in the group at once, and a per-package budget would keep
the step running for most of an hour. Past the deadline the remaining packages
fail fast, and the error names the bound that was hit.
`PIE_REGISTRY_PROPAGATION_DEADLINE_SECONDS` widens it for a rerun.

## How CI authenticates to npm

Both publishing workflows, `release.yml` and `publish-preloaded-player.yml`,
publish with an npm token or by OIDC trusted publishing. Under OIDC, GitHub
mints a short-lived id-token for the run and npm exchanges it for publish
rights: no long-lived credential is stored, and npm attaches a provenance
attestation to every package it publishes.

OIDC is the target mode. npm no longer lets a token that bypasses 2FA change
trusted-publishing configuration, and plans to withdraw its publish capability
around January 2027 (npm changelog, 2026-07-08). A token can also expire
unnoticed and break a release.

### Auth mode resolution

Each publish run resolves an auth mode before publishing. Push-triggered runs
use `auto`.

| `publish_auth` input | Result |
| --- | --- |
| `auto` (default) | token if the `NPM_TOKEN` secret exists, otherwise oidc |
| `token` | token; fails fast if `NPM_TOKEN` is absent |
| `oidc` | oidc |

The repository publishes by token for as long as the `NPM_TOKEN` secret
exists. Deleting the secret is the cutover to OIDC; no workflow edit is needed.

### Token mode

The `token` mode and local publishing use an npm token with publish rights on
the `@pie-players` scope: CI reads it from the `NPM_TOKEN` repository secret
(Settings → Secrets and variables → Actions), local runs from `NPM_TOKEN` in
the repo's `.env` ([Manual publishing](#manual-publishing-local)).
`npm org ls pie-players --registry=https://registry.npmjs.org/` lists the
accounts with access. To rotate, generate a replacement on npmjs.com, update
the secret and `.env`, then revoke the old token. Revoke a leaked token first,
then replace it and review recent publishes.

On token-mode publish runs, `scripts/check-npm-auth.mjs` runs before the
publish step. npm reports an expired or revoked token as `E404` on publish,
which reads like a missing package; the check names the credential problem
before any package publishes.

### Requirements the workflows satisfy

- `permissions: id-token: write` on the publishing job.
- npm >= 11.5.1. The Node.js version pinned in `.nvmrc` (22.16.0) bundles npm
  10.9.2, which predates OIDC support, so both workflows upgrade npm in the job
  and assert the resolved version.
- The canonical `repository.url` in every publishable manifest
  ([Required package metadata](#required-package-metadata)). npm compares it
  with the repository it publishes from when generating provenance.
- No `_authToken` line in the runner's `.npmrc` on an OIDC run.
  `actions/setup-node` runs with `registry-url`, so it writes
  `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`. Under OIDC there is no
  token, so that line expands to an *empty* credential and npm attempts token
  auth instead of falling through to trusted publishing. The OIDC step strips
  it. Suspect this line when the workflow looks correct and publish still
  reports an auth error.

### Trusted publisher configuration

A trusted-publisher record on npm names the workflow file allowed to publish a
package by OIDC. Configure it once per package, from a local terminal:

```bash
npm login
bun run trusted-publishers                                  # dry run
bun run trusted-publishers -- --apply  --only @pie-players/pie-theme   # rehearse on one
bun run trusted-publishers -- --verify --only @pie-players/pie-theme
bun run trusted-publishers -- --apply                       # all packages
bun run trusted-publishers -- --verify
```

- `npm trust` needs npm >= 12. The script bootstraps npm 12 into a temp prefix
  and leaves your global npm alone, because npm 12 changes install-time
  defaults.
- Every `npm trust` operation is 2FA-protected and npm does not reuse the
  authentication between invocations, so expect an OTP prompt per package, for
  reads as well as writes. The script refuses to run in CI for this reason.
- `npm trust github --dry-run` exits 0 even for a package that does not exist,
  so a clean dry run proves only that the arguments are well-formed.
  `--apply --only <pkg>` is the real rehearsal.
- npm permits one trusted publisher per package, so re-applying to a
  configured package fails. Confirm with `--verify`.
- A record attaches only to a package the registry already has: `--apply` on a
  never-published name fails with `E404 Package not found`, and that package
  needs `bun run bootstrap-package` first
  ([Adding a publishable package](#adding-a-publishable-package)).
- `@pie-players/pie-preloaded-player` is registered against
  `publish-preloaded-player.yml`, every other package against `release.yml`.
- Each confirmed claim is written to `scripts/trusted-publishers.json` as the
  run proceeds, so an interrupted run keeps the OTPs already paid for. Commit
  that file: `check:trusted-publishers` reads it, and an uncommitted ledger
  fails the check for packages you have just claimed.

### Adding a publishable package

A new package needs one interactive first publish before a release can publish
it. A release authenticates by OIDC, which needs a trusted-publisher record per
package, and npm attaches a record only to a name the registry already has.

`bun run bootstrap-package` is that first publish. Run it for one package, from
the repository root, with an npm session (`npm login`) that holds publish
rights on the scope:

```bash
bun run bootstrap-package -- --only @pie-players/<new-package> --dry-run
bun run bootstrap-package -- --only @pie-players/<new-package>
git add scripts/trusted-publishers.json   # the claim ledger is part of the change
```

The script checks everything reversible before anything irreversible: the
package is publishable and in the fixed group, the group version is uniform,
npm has never seen the name, every `workspace:` range resolves to a published
version, and you are logged in. It then builds, resolves the workspace ranges
the way a release does, shows the exact tarball, publishes, restores the
manifest, and delegates the claim to `configure-trusted-publishers.mjs`, so the
`npm trust` call and the ledger have one owner. Expect two OTP prompts: one for
the publish, one for the claim.

- **One package per run.** A first publish is irreversible (npm allows
  unpublishing only within 72 hours and never reuses a name/version pair), so a
  batch that failed halfway would leave a partial set of new names on the
  registry.
- **Every dependency's group version must already be published.** A first
  publish resolves `workspace:*` against the branch's group version; pinning an
  unpublished sibling produces a package that resolves for nobody, and the
  failure surfaces at a consumer's install.

After the bootstrap the package is ordinary: add a changeset and merge, and the
next release publishes it with the rest of the group. Renaming a publishable
package counts as adding one, because the new name needs its own record.

#### Bootstrap version

The bootstrap publishes the version on the branch it runs on, and release
bumps land only on `master`, so a bootstrap from `develop` publishes whatever
version the last back-merge left there. `check:fixed-versioning` tolerates the
gap for a package whose entire release history is one version below the group,
and reports the packages it excused. The discriminant is release history: a
package that published repeatedly and then fell behind is drift, and still
fails. The newcomer joins the group at the next release version.

### Trusted-publisher claim check

A package without a record fails with `ENEEDAUTH` while its siblings publish,
which splits the registry across two versions and leaves git holding a version
that was never fully published. `bun run check:trusted-publishers` asserts that
every package a release would publish has a recorded claim, and routes each
missing one to the command that fixes it: `bootstrap-package` for a name the
registry does not have, `trusted-publishers -- --apply` for one it does.
`release.yml` runs it on OIDC publish runs, before the publish step.

It stays out of `verify:publish`, because records matter only when a run
authenticates by OIDC: `release.yml` runs `verify:publish` before resolving the
auth mode, and `release:with-version` publishes by token. Run it directly when
preparing a claim.

The check is fatal only for the packages `release.yml` publishes, and prints
gaps elsewhere as `note (other workflow)`.
`bun ./scripts/check-trusted-publishers.mjs --all` makes every package fatal;
run it before publishing the preloaded player.

The check reads the committed ledger because every `npm trust` read is
2FA-protected, so nothing on a runner can ask npm which packages have records.
The ledger proves the claim step ran; it does not prove npm's current state. A
revoked record, or a hand-written entry, passes the check and still fails the
publish. `--verify` is the live check and `check:provenance` the
after-the-fact one.

### Verifying a release used OIDC

The registry does not expose trusted-publisher configuration, so provenance
attestations are the only external signal:

```bash
bun run check:provenance x.y.z   # without an argument: the workspace version
```

It tells published-without-provenance (a missing or misconfigured trusted
publisher, or a token fallback) apart from not-published-at-all (a partial
release). The preloaded player has no group version; check one of its builds
with `npm view @pie-players/pie-preloaded-player@<version> dist.attestations`.

## Common remediation

- Metadata failures: update the `package.json` fields the error lists.
- `publint` failures: align `exports`, `types` and packed files with the
  published entry points.
- ATTW failures: fix the type entry points or their resolution.
- Pack-integrity failures (`check:pack-integrity:real`): include every declared
  export target in `files` and produce it in the build.
- Fixed-versioning failures: confirm every publishable package has the same
  version after `bun run version`, and that internal `@pie-players/*`
  dependencies stay `workspace:*` in source manifests.

## Manual publishing (local)

`release:with-version` is the local publish command. `bun run release` alone
skips the version bump and the gates, and `npm publish` does not resolve
`workspace:*` ranges, so run neither directly.

```bash
bun run release:with-version
```

It runs the CI release path in order:

1. `bun run check:changeset-patch-only`: rejects a pending `minor` or `major`
   changeset.
2. `scripts/create-temporary-release-changeset.mjs`: writes
   `.changeset/temporary-release-all-packages.md`, declaring `patch` for every
   publishable package, so the lockstep set is always covered. Author
   changesets apply alongside it. It writes nothing while npm does not yet have
   the local version.
3. `bun run version`: applies the changesets to the `package.json` and
   `CHANGELOG.md` files.
4. `bun run restore:workspace-ranges`: keeps source manifests on `workspace:*`.
5. `bun run check:npm-auth`: fails fast if the token in `.env` is missing or
   expired, or `@pie-players` access is unavailable.
6. `bun run verify:publish`: the full [publish gate](#publish-gates).
7. `bun run test`: the workspace test suites.
8. `bun run release`: builds, then runs `changeset publish` with workspace
   ranges resolved, under `dotenvx run -f .env`. It does not publish
   `@pie-players/pie-preloaded-player`.
9. `bun run restore:workspace-ranges`: restores `workspace:*` in source
   manifests.

The repo's `.env` holds the `NPM_TOKEN` with `@pie-players` publish access.
`check:npm-auth` and `release` load it through `dotenvx run -f .env`, so no
`npm login` is needed. On errors such as:

- `npm notice Access token expired or revoked`
- `E404 Not Found - PUT https://registry.npmjs.org/@pie-players%2f...`

check that the token in `.env` is still valid, or re-authenticate and update
`.env`:

```bash
npm whoami --registry=https://registry.npmjs.org/
npm org ls pie-players --registry=https://registry.npmjs.org/
```

### Retrying a failed local release

Once `bun run version` has changed the manifests, do not rerun
`release:with-version`: the temporary-changeset step compares the local version
with npm, and after a partial publish it can find them equal and bump again.
Retry from the post-version steps:

```bash
bun run check:npm-auth && bun run verify:publish && bun run test && bun run release && bun run restore:workspace-ranges
```

`check:fixed-versioning` treats a package npm has never seen as joining at the
lockstep version, so a first-time package needs no override.
