# Section TTS Integration Complete

Server-side TTS support is integrated through the shared TTS packages and host-app API routes.

## Delivered Components

- `packages/tts-server-core` for server provider interfaces
- `packages/tts-server-polly` for AWS Polly implementation
- `packages/tts-client-server` for browser/client integration

## Host App Requirements

Any host app that wants server-side TTS should provide:

- `src/routes/api/tts/synthesize/+server.ts`
- `src/routes/api/tts/voices/+server.ts`

The client should initialize `ServerTTSProvider` against `/api/tts`.

## Environment

Set AWS credentials in `.env` (or runtime secrets management):

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

## References

- `docs/aws-polly-setup-guide.md`
- `docs/environment-setup.md`
- `packages/tts-client-server/README.md`
