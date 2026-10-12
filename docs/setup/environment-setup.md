# Environment Setup

This page lists the environment variables the demo apps read, how they load,
and the fixes for the failures they cause. Every variable is optional: without
a `.env`, the demos run with browser speech for text-to-speech, and the
features that need a key or a credential, such as server TTS and the Desmos
calculator, are unavailable. Installing and running the demos is covered in
[Demo System](./demo_system.md).

```bash
cp .env.example .env
```

[`.env.example`](../../.env.example) carries every variable with a comment.

## How It Works

The root `dev:*` scripts run under `@dotenvx/dotenvx` (`dotenvx run --`), which
loads the root `.env` before the dev server starts. The section demos' server
also loads the root `.env` itself, so they read it when started from
`apps/section-demos`. The other apps read it only through the root scripts.

## Text-to-Speech Defaults

`ToolkitCoordinator` uses browser speech unless `tools.providers.textToSpeech`
sets `backend: "server"`, and falls back to browser speech when a server
provider fails to initialize.

- The section demos default to browser speech
  (`SECTION_DEMOS_DEFAULT_TTS_TOOL_PROVIDER` in
  `apps/section-demos/src/lib/demo-runtime/section-demos-default-tts.ts`). The
  same file keeps an AWS Polly preset over the `/api/tts` proxy, which the SSML
  demos use, and the menu bar's TTS settings panel switches provider.
- The assessment demos use Polly when the demo server's
  `/api/tts/polly/voices` route answers, which needs the AWS variables, and
  browser speech otherwise.

## What Environment Variables Do

### AWS Polly TTS

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalr...
```

Server-side TTS through Polly, with speech marks for word-level highlighting,
in the section and assessment demos. `AWS_SESSION_TOKEN` is read as well, for
temporary credentials. The [AWS Polly setup guide](../accessibility/aws-polly-setup-guide.md)
covers the IAM user and its policy.

### Google Cloud TTS

`GOOGLE_API_KEY`, or `GOOGLE_APPLICATION_CREDENTIALS` (a service-account JSON path)
with `GOOGLE_CLOUD_PROJECT`, enables the demos' Google TTS routes.

### Desmos

`DESMOS_API_KEY` is the licensed key the Desmos calculator needs to load. The
section demos' `/api/tools/desmos/auth` route returns it to the browser, which puts
it in the Desmos script URL, so the route keeps it out of bundles without making
it secret.

### SC TTS

`TTS_SCHOOLCITY_URL`, `TTS_SCHOOLCITY_API_KEY` and `TTS_SCHOOLCITY_ISS` back the
section demos' `/api/tts/sc` route. `TTS_SCHOOLCITY_ASSET_ORIGINS` replaces the
default audio-asset policy with an exact-origin allow-list. See
[section-demos](../../apps/section-demos/README.md).

## Secrets and Committed Files

- `.env.example` is committed, with placeholder values only.
- [`docs/accessibility/aws-polly-iam-policy.json`](../accessibility/aws-polly-iam-policy.json)
  is committed: the minimal IAM policy for the Polly credentials.
- `.gitignore` excludes `.env`, `.env.local` and `.env.*.local`.

## Troubleshooting

### Missing `dist/*.js` import errors

An error naming a missing `dist/*.js` file in a package such as
`pie-tool-graph`, `pie-tool-line-reader` or `pie-tool-ruler` means the packages
are unbuilt. Stop the dev server, then build and start it again:

```bash
bun run dev:section -- --rebuild

# or
bun run build && bun run dev:section
```

### Environment variables not loading

Start the demo from the repository root with its `bun run dev:*` script.
`bun run dev` inside an app folder runs plain `vite dev`, without dotenvx.

### TTS not working

Browser speech, the default, uses the browser's Web Speech API
(`speechSynthesis`) and its installed voices. A server provider that fails to
initialize logs a `[ToolkitCoordinator]` warning and falls back to browser
speech, so a demo meant to use Polly that speaks in a browser voice points at
the Polly route or its credentials.

Check the AWS variables:

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

1. Add to [.env.example](../../.env.example) with a comment
2. Add to this document
3. Update the docs of the packages that read it

## See Also

- [AWS Polly Setup Guide](../accessibility/aws-polly-setup-guide.md) - Detailed AWS configuration
- [TTS Architecture](../accessibility/tts-architecture.md) - How TTS works
- [AWS Polly integration guide](../../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md) - Server implementation, including a Redis cache for synthesis results
