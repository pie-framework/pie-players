# Environment Setup

This document explains how to configure environment variables for PIE Players demos.

## Quick Start

From the monorepo root, use this sequence for deterministic first-time setup.

- **Install workspace dependencies**:

```bash
bun install
```

- **Copy the example file**:

```bash
cp .env.example .env
```

- **Add your AWS credentials** (for TTS):

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
```

- **First run** (build package artifacts + start section demos):

```bash
bun run dev:section -- --rebuild
```

- **Normal daily run**:

```bash
bun run dev:section
```

The demo scripts load `.env` through `dotenvx`.

## Packaging reliability contract

- Demo and package consumers use publish-style `dist` entrypoints.
- Browser custom-element packages (for example `pie-item-player`,
  `pie-section-player`) are browser-only runtime packages.
- Node-import-safe package guidance and boundary details live in:
  [`library-packaging-strategy.md`](./library-packaging-strategy.md)
- `@pie-players/pie-section-player/browser` is the no-bundler entry.

## What Environment Variables Do

### AWS Polly TTS (Required for server-side TTS)

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalr...
```

**Used by**: Server-side TTS with speech marks for word-level highlighting

**Setup guide**: See [AWS Polly Setup Guide](../accessibility/aws-polly-setup-guide.md)

`AWS_SESSION_TOKEN` is read as well, for temporary credentials.

### Google Cloud TTS (optional)

`GOOGLE_API_KEY`, or `GOOGLE_APPLICATION_CREDENTIALS` (a service-account JSON path)
with `GOOGLE_CLOUD_PROJECT`, enables the demos' Google TTS routes.

### Desmos (recommended)

`DESMOS_API_KEY` is the licensed key the Desmos calculator needs to load. The
section demos' `/api/tools/desmos/auth` route returns it to the browser, which puts
it in the Desmos script URL, so the route keeps it out of bundles without making
it secret.

### SchoolCity TTS (optional)

`TTS_SCHOOLCITY_URL`, `TTS_SCHOOLCITY_API_KEY` and `TTS_SCHOOLCITY_ISS` back the
section demos' `/api/tts/sc` route. `TTS_SCHOOLCITY_ASSET_ORIGINS` replaces the
default audio-asset policy with an exact-origin allow-list. See
[section-demos](../../apps/section-demos/README.md).

### Redis caching

Nothing in this repository reads `REDIS_URL`. The Polly SvelteKit example
(`packages/tts-server-polly/examples/sveltekit/synthesize-server.ts`) carries a
commented-out Redis cache for synthesis results that a deployment can adapt.

## How It Works

### dotenvx

We use `@dotenvx/dotenvx` to load environment variables from `.env` in the monorepo root.

Demo entrypoints run through `dotenvx run --` so local `.env` values are available during startup.

## Security

### Committed

- `.env.example` - Template file (no secrets)
- [`docs/accessibility/aws-polly-iam-policy.json`](../accessibility/aws-polly-iam-policy.json) - the minimal IAM policy for the Polly credentials

### Never committed

- `.env` - Contains your secrets
- `.env.local` - Local overrides
- `.env.*.local` - Environment-specific secrets

These are all in `.gitignore`.

## Troubleshooting

### Missing `dist/*.js` import errors

If you see errors for packages like `pie-tool-graph`, `pie-tool-line-reader`, or
`pie-tool-ruler` mentioning missing `dist/*.js`, local package artifacts have
not been built yet.

```bash
# Build package artifacts and start section demos in one command
bun run dev:section -- --rebuild

# Or, if the dev server is already running:
bun run build
bun run dev:section
```

### Environment variables not loading

**Check**: Are you running scripts from the monorepo root?

```bash
# From the root: loads .env
bun run dev:section

# From the app folder: plain `vite dev`, .env does not load
cd apps/section-demos
bun run dev
```

**Fix**: Always run scripts from the root using `bun run <script>`

### TTS not working

**Check**: Do you have AWS credentials configured?

```bash
# Check if .env exists
ls .env

# Check which AWS variables are set (names only)
dotenvx run -- printenv | cut -d= -f1 | grep '^AWS_'
```

**Expected output**:

```text
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

**Fix**: See [AWS Polly Setup Guide](../accessibility/aws-polly-setup-guide.md)

## Adding New Environment Variables

1. Add to [.env.example](../../.env.example) with documentation
2. Add to this document
3. Update relevant package docs if needed

## See Also

- [AWS Polly Setup Guide](../accessibility/aws-polly-setup-guide.md) - Detailed AWS configuration
- [TTS Architecture](../accessibility/tts-architecture.md) - How TTS works
- [TTS Integration Guide](../../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md) - Server implementation
