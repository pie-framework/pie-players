# Publishing Contract

This repository publishes multiple workspace packages to npm. To keep releases
predictable for external consumers, publishing is gated by metadata and artifact
validation checks.

## Versioning model

The monorepo uses Changesets **fixed versioning** for all publishable
`@pie-players/*` packages:

- all publishable packages move in a lockstep release train
- all publishable packages share one version at publish time
- source manifests keep internal references as `workspace:*`
- publish rewrites workspace refs to concrete versions, then restores manifests

### Why fixed (lockstep) versioning

Publishable packages in this repo form a single cohesive player framework
(players, tools, TTS servers, theming, toolkits). Internal contracts cross
package boundaries — element registration, theme tokens, tool coordination,
session shape — so consumers almost always adopt the suite as a whole.

Fixed versioning gives consumers two guarantees:

1. **One version per upgrade.** Pick a version, bump every `@pie-players/*`
   dependency to it. There is no compatibility matrix to reason about across
   `@pie-players/*` packages.
2. **Tested together.** Packages that publish at the same version are designed
   and tested as a unit at that version.

The cost is that releases bump **every** publishable package — including ones
whose source did not change in that release — so some churn is unavoidable on
every release PR. This is expected and enforced.

### Consequences for release preparation

- Every release/versioning step must cover **all** publishable packages. Do not
  prepare a release bump scoped to only the changed packages; that would break
  the lockstep invariant. See [`AGENTS.md`](../../AGENTS.md).
- While the project remains on the pre-1.0 `0.x.y` line, every release is a
  `patch` bump across every publishable package, even when a change is
  breaking. Document breaking changes clearly in the changeset body, but do not
  author `minor` or `major` changesets unless the maintainer explicitly updates
  the release policy.
- Changesets' `fixed` block in
  [`../../.changeset/config.json`](../../.changeset/config.json) is the source
  of truth for which packages are in the lockstep set. New publishable packages
  must be added there.
- `scripts/check-fixed-versioning.mjs` (run via `bun run verify:publish`) is the
  invariant check that fails CI if versions drift.

## Required package metadata (publishable workspaces)

For every non-private workspace package in `packages/*`:

- `publishConfig.access` must be `public`
- `license` must be present
- `homepage` must be present
- `bugs` must be present (`string` URL or object with `url`)
- `repository.directory` must match workspace location
- `files` must be present and non-empty
- `exports` or (`main` + `types`) must be present
- `engines.node` must be present
- `sideEffects` must be explicitly set

Policy and validator:

- `scripts/publish-policy.json`
- `scripts/check-package-metadata.mjs`
- `docs/setup/publishable_packages.md` (current package inventory)

## Local preflight before opening/merging a release

Run:

```bash
bun run verify:publish
```

`verify:publish` executes:

- package build
- fixed-versioning invariants (`scripts/check-fixed-versioning.mjs`)
- metadata policy validation
- custom-element contract checks (`check:custom-elements`, `check:ce-define-safety`)
- `publint` package surface checks
- ATTW type-surface checks (`scripts/check-attw.mjs`)
- pack exports check (`npm pack --dry-run` + export target verification)
- pack smoke check (`npm pack` tarball verification)
- Node consumer import boundary checks (`scripts/check-node-consumer-imports.mjs`)
- dependency, publish-surface, sourcemap, and runtime boundary checks

## Dist-only publish surface

Publishable packages expose generated `dist` artifacts as their public API. Package
`exports`, `main`, `module`, `types`, CDN fields, and packed source-bearing files
must not point at raw source paths such as `src`, root `.ts`/`.tsx`, `.svelte`,
`.svelte.ts`, or `development` conditions that resolve to source.

Debuggability is provided by generated sourcemaps, not by importable source files.
`bun run check:sourcemaps` rejects packed `.js.map` files that reference source
files missing from the npm tarball unless the map embeds source content.

The common gates are:

- `bun run check:publish-surface`
- `bun run check:sourcemaps`

## Release intent in CI

The release workflow enforces explicit intent:

- Push-driven runs rely on release evidence:
  - `.changeset/*.md` files for release PR creation
  - package/changelog version bumps for publish runs
- Manual runs (`workflow_dispatch`) require `release_intent`:
  - `version-pr` (requires changesets)
  - `publish` (requires version bump/changelog evidence by default)
  - `publish` + `force_publish=true` (manual recovery mode for rerunning a failed publish from `master`)

### Manual publish recovery

If a publish failed for transient reasons (registry outage, webhook issue, etc.) and
your fixes are already in `master`, rerun the release workflow manually:

1. Open **Actions → Release → Run workflow**
2. Branch: `master`
3. `release_intent`: `publish`
4. `force_publish`: `true`

This bypasses version-bump detection checks for that manual run while keeping normal
push-driven safety checks in place.

#### When the previous publish only partly succeeded

Fixed versioning means npm authenticates the run as a whole, so a run that loses auth
partway leaves the registry split: the packages that made it sit at the version being
released, the rest stay a patch behind. Rerunning the manual publish above is the repair —
`changeset publish` skips the versions that already landed.

`check:fixed-versioning` recognises that one split and reports it rather than failing:

```
[check-fixed-versioning] Completing a partial publish of 0.3.61. 1 package(s) already
published it (@pie-players/pie-theme) and 35 are still one patch behind ...
```

It stays fatal for any other multi-version state, because republishing will not reconcile
drift — only an unfinished publish of the *local* version is recoverable this way. Do not
reach for `SKIP_NPM_VERSION_SEQUENCE_CHECK=1` to get past a split: that also disables the
patch-sequence and version-skip checks, which are what stop a release from silently
skipping a version.

Do not try to fix a split by unpublishing the package that succeeded. npm refuses to
republish a version number once it has been unpublished, so removing it makes that version
permanently unreachable for that package and forces the whole group forward anyway.

Publish-path runs execute the full `bun run verify:publish` gate before
`changesets/action` can publish.

### Back-merge to develop

A release commit exists only on `master`: `changesets/action` bumps the manifests, assembles the
`CHANGELOG.md` files, and deletes the consumed changesets there. After a successful publish
`release.yml` opens a `master` → `develop` PR to return it. Merge it.

Deferring it leaves the manifests on `develop` at whatever version the last back-merge set, and
`bootstrap-package` reads the group version from the branch it runs on — so the next new package
is published far below the group and `check-fixed-versioning` blocks the following release.
`@pie-players/pie-tool-sign-language` was published at 0.3.50 against a group at 0.3.64 this way.

A PR rather than an automatic push, because the merge can conflict where `develop` and the release
both appended to a `CHANGELOG.md`. Take both sides, release entry first. The step is idempotent: it
reuses an open back-merge PR instead of opening a second, and skips when `develop` already contains
`master`. It cannot fail a release — a publish that succeeded is not reported as failed over its
follow-up bookkeeping.

After publish, CI also validates internal dependency closure in the registry:

- `scripts/check-published-closure.mjs`
- confirms published `@pie-players/*` packages only reference resolvable internal versions
- fails if any `workspace:*` leak or unresolved internal dependency is detected

## How CI authenticates to npm

CI publishes via **OIDC trusted publishing**: GitHub mints a short-lived id-token for the
workflow run, and npm exchanges it for publish rights. No long-lived npm credential lives
in the repository, and npm generates a provenance attestation for every package it
publishes this way.

Driver: per npm's 2026-07-08 changelog, tokens that bypass 2FA lose the ability to change
trusted publishing configuration from early August 2026, and lose direct publishing
capability around January 2027. A personal token also expires unnoticed and silently
breaks releases.

### Auth mode resolution

Both publishing workflows (`release.yml` and `publish-preloaded-player.yml`) resolve an
auth mode before publishing:

| `publish_auth` input | Result |
| --- | --- |
| `auto` (default) | token if the `NPM_TOKEN` secret exists, otherwise oidc |
| `token` | token; fails fast if `NPM_TOKEN` is absent |
| `oidc` | oidc |

Because `auto` prefers a token when one is present, **the cutover is a secret deletion,
not a workflow edit**. While `NPM_TOKEN` exists the repo keeps publishing via token.

### Requirements the workflows satisfy

- `permissions: id-token: write` on the publishing job.
- npm >= 11.5.1. The Node pinned in `.nvmrc` (22.16.0) bundles npm 10.9.2, which predates
  OIDC support, so both workflows upgrade npm in-job and assert the resolved version.
- `repository.url` in the canonical `git+https://github.com/pie-framework/pie-players.git`
  form in every publishable manifest. npm compares this against the repository it publishes
  from when generating provenance. `check:package-metadata` enforces it.
- No `_authToken` line in the runner's `.npmrc` on an OIDC run. `actions/setup-node` runs
  with `registry-url`, so it writes `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`.
  Under OIDC there is no token, so that line expands to an *empty* credential and npm
  attempts token auth instead of falling through to trusted publishing. The OIDC step
  strips it. This is the failure mode to suspect when the workflow looks correct but
  publish still reports an auth error.

### Trusted publisher configuration

One-time, per package, from a local terminal:

```bash
npm login
bun run trusted-publishers                                  # dry run
bun run trusted-publishers -- --apply  --only @pie-players/pie-theme   # rehearse on one
bun run trusted-publishers -- --verify --only @pie-players/pie-theme
bun run trusted-publishers -- --apply                       # all packages
bun run trusted-publishers -- --verify
```

Notes:

- Requires npm >= 12 for `npm trust`. The script bootstraps npm 12 into a temp prefix
  rather than upgrading your global npm, because npm 12 changes install-time defaults.
- Every `npm trust` operation is 2FA-protected and npm does not reuse the authentication
  between invocations, so expect **an OTP prompt per package**, for reads as well as
  writes. This is why the script refuses to run in CI.
- `npm trust github --dry-run` exits 0 even for a package that does not exist, so a clean
  dry run proves the arguments are well-formed and nothing more. Use `--apply --only <pkg>`
  as the real rehearsal.
- npm permits only **one** trusted publisher per package, so re-applying to an
  already-configured package fails. That is expected; confirm with `--verify`.
- A record attaches only to a package the registry already has. `--apply` on a name that has
  never been published fails with `E404 Package not found`; that package needs
  `bun run bootstrap-package` first (see *Adding a publishable package later*).
- The record names a specific workflow file. `@pie-players/pie-preloaded-player` is
  registered against `publish-preloaded-player.yml`; everything else against `release.yml`.
- Each confirmed claim is recorded in `scripts/trusted-publishers.json`, written per package
  as the run proceeds so an interrupted run does not discard the OTPs already paid for.
  **Commit that file** — `check-trusted-publishers.mjs` reads it, so an uncommitted ledger
  fails the check for packages you have in fact just claimed.

### Adding a publishable package later

A new package needs one interactive first publish before the release workflow can ever publish
it, because trusted publishing is circular for a name that does not exist:

- A release authenticates by OIDC, which requires a trusted-publisher record per package.
- `npm trust github` attaches a record to a package **on the registry**. For a name npm has
  never seen it fails with `E404 Package not found`.

`bun run bootstrap-package` is that first publish. One package per run, from the repository
root, with an npm session (`npm login`) that holds publish rights on the scope:

```bash
bun run bootstrap-package -- --only @pie-players/<new-package> --dry-run
bun run bootstrap-package -- --only @pie-players/<new-package>
git add scripts/trusted-publishers.json   # the claim ledger is part of the change
```

It preflights everything reversible before anything irreversible — the package is publishable
and in the fixed group, the group version is uniform, npm has never seen the name, every
`workspace:` range resolves to a version that is actually published, and you are logged in —
then builds, resolves the manifest's workspace ranges the way a release does, shows the exact
tarball, publishes, restores the manifest, and delegates the claim to
`configure-trusted-publishers.mjs` so the `npm trust` call and the ledger have one owner.
Expect two OTP prompts: one for the publish, one for the claim.

Two constraints the script enforces rather than explains at the prompt:

- **One package per run.** A first publish is irreversible — npm allows unpublishing only
  within 72 hours and never permits reusing a name/version pair — so a batch that failed
  halfway would leave a partial set of new names on the registry.
- **The group version must already be published for every dependency.** A first publish from
  a long-lived branch resolves `workspace:*` against that branch's group version, which can be
  behind what was ever released; pinning an unpublished sibling produces a package that
  resolves for nobody, and the failure surfaces at a consumer's install.

After the bootstrap the package is ordinary: add a changeset, merge, and the release publishes
it with the rest of the group over OIDC at the next group version.

Versioning is fixed, so a release authenticates the run as a whole. A package with no record
fails with `ENEEDAUTH` while its siblings succeed, leaving the registry split across two
versions and git holding a version that was never fully published.
`bun run check:trusted-publishers` is the guard: it asserts that every package a release would
publish has a recorded claim, and routes each missing one to the command that can actually fix
it — `bootstrap-package` for a name the registry does not have, `trusted-publishers -- --apply`
for one it does. It runs in `release.yml` ahead of the version bump (oidc mode, publish runs
only), so a forgotten claim fails the release *before* changesets commits bumped versions
instead of halfway through publishing.

It is deliberately **not** part of `verify:publish`. Trusted-publisher records only matter
when the run authenticates by OIDC, and `verify:publish` cannot know whether it will:
`release.yml` runs it *before* the auth mode is resolved, and `release:with-version` is a
token-based local publish path where the records are irrelevant. Including it there failed
token-mode publishes over records they never needed. Run it directly when preparing a claim.

The check is fatal only for the packages `release.yml` publishes. Not every publishable
package ships on the release path — `@pie-players/pie-preloaded-player` is published by
`publish-preloaded-player.yml` on its own version scheme — and a release must not be blocked
by a package it never touches. Gaps outside that scope are printed as
`note (other workflow)` so they stay visible to whoever owns that workflow. Use
`bun ./scripts/check-trusted-publishers.mjs --all` to make every package fatal, which is the
right check to run before publishing the preloaded player.

Renaming a publishable package counts as adding one: the new name needs its own record.

Why a committed ledger rather than asking npm directly: every `npm trust` read is
2FA-protected, so nothing on a runner can query which packages have records. The ledger
proves the claim step was carried out; it does not prove npm's current state. A revoked
record, or an entry someone hand-wrote, passes this check and still fails the publish.
`--verify` is the live check, and `check:provenance` is the after-the-fact one.

### Verifying a release actually used OIDC

The registry does not expose trusted-publisher configuration, so provenance attestations
are the only external signal:

```bash
bun run check:provenance 0.4.0
```

It distinguishes published-without-provenance (missing or misconfigured trusted publisher,
or a token fallback) from not-published-at-all (partial release — versioning is fixed, so
all packages should move together). `release.yml` runs this after every publish.

### Pre-flight credential check (token mode)

`scripts/check-npm-auth.mjs` runs in the release workflow **before** the version bump,
gated to token mode and publish runs. npm surfaces an expired or revoked token as `E404` on
publish, which reads like a missing package — and by then changesets has already committed
the bumped versions, leaving a version in git that was never published. OIDC has no
credential to check, hence the gate.

## Common remediation

- Metadata failures: update package `package.json` fields listed in the error.
- `publint` failures: align `exports`, `types`, and packed files with published
  entry points.
- ATTW failures: fix type entrypoints/resolution issues or move package to the
  documented exclusion set with rationale until remediated.
- Pack export/smoke failures: ensure all declared targets are included in `files`
  and produced by build output.
- Fixed-versioning failures:
  - ensure all publishable package versions are identical after `bun run version`
  - ensure internal `@pie-players/*` deps remain `workspace:*` in source manifests

## Local release retry (without re-bumping versions)

If `bun run release:with-version` fails after `bun run version` has already updated
`package.json` and `CHANGELOG.md` files, do not rerun `release:with-version`.
Rerunning it creates another temporary changeset and bumps versions again.

Retry from the post-version steps instead:

```bash
bun run check:npm-auth && SKIP_NPM_VERSION_SEQUENCE_CHECK=1 bun run verify:publish && bun run test && bun run release && bun run restore:workspace-ranges
```

Use `SKIP_NPM_VERSION_SEQUENCE_CHECK=1` for recovery runs when
`check-fixed-versioning` fails with npm `E404` for a package being published for
the first time (for example `npm view @pie-players/<pkg> version` returning not
found).

## Manual publishing (local)

Local publishing always uses the codebase and branch currently checked out.
Before running the publish command, confirm `git branch --show-current` and
`git status --short`; do not switch to `master`, `main`, `develop`, or the
GitHub workflow unless that is explicitly requested.

The canonical local-publish command is:

```bash
bun run release:with-version
```

`release:with-version` runs the entire CI release path locally, in order:

1. `scripts/create-temporary-release-changeset.mjs` — writes a temporary
   `.changeset/temporary-release-all-packages.md` declaring `patch` for every
   publishable package, so the lockstep set is always covered (existing
   author-written changesets coexist with this temporary one and may upgrade
   the bump for some / all packages).
2. `bun run version` — applies all changesets to `package.json` and
   `CHANGELOG.md` files.
3. `bun run restore:workspace-ranges` — keeps source manifests on
   `workspace:*` after `version`.
4. `bun run check:npm-auth` — fails fast if the NPM token in `.env` is
   missing/expired or `@pie-players` access is unavailable.
5. `bun run verify:publish` — full publish gate (build + every `check:*`).
6. `bun run test` — workspace test suites.
7. `bun run release` — `dotenvx run -f .env` wrapper around build +
   `changeset publish` (with workspace ranges resolved). This does **not**
   publish the preloaded-player bundle; see `docs/preloaded-player/readme.md`.
8. `bun run restore:workspace-ranges` — restore `workspace:*` ranges in
   source manifests.

NPM authentication: the repo's `.env` file holds the `NPM_TOKEN` for
`@pie-players` publish access. Both `check:npm-auth` and `release` load it via
`dotenvx run -f .env`. No separate `npm login` is needed.

If you hit errors like:

- `npm notice Access token expired or revoked`
- `E404 Not Found - PUT https://registry.npmjs.org/@pie-players%2f...`

verify the token in `.env` is still valid (or re-auth and update `.env`):

```bash
npm whoami --registry=https://registry.npmjs.org/
npm org ls pie-players --registry=https://registry.npmjs.org/
```
