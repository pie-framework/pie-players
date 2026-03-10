# Environment Setup

This document explains how to configure environment variables for PIE Players demos.

## Quick Start

1. **Copy the example file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your AWS credentials** (for TTS):
   ```bash
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_here
   ```

3. **Run a demo**:
   ```bash
   bun run dev:section
   ```

That's it! The demo scripts automatically load `.env` using `dotenvx`.

## What Environment Variables Do

### AWS Polly TTS (Required for server-side TTS)

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalr...
```

**Used by**: Server-side TTS with speech marks for word-level highlighting

**Setup guide**: See [AWS Polly Setup Guide](./aws-polly-setup-guide.md)

### Redis Caching (Optional, but recommended)

```bash
REDIS_URL=redis://localhost:6379
```

**Benefits**:
- Caches TTS synthesis results for 24 hours
- Reduces AWS Polly API costs by 70-90%
- Faster response times for repeated content

**Setup**:
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

## How It Works

### dotenvx

We use `@dotenvx/dotenvx` to load environment variables from `.env` in the monorepo root.

All demo scripts are wrapped with `dotenvx run --`:

```json
{
  "scripts": {
    "dev:section": "dotenvx run -- bun run --cwd apps/section-demos dev"
  }
}
```

### Why dotenvx?

- ✅ **Runs from monorepo root** - All demos share one `.env` file
- ✅ **More secure** than dotenv - Better handling of encrypted secrets
- ✅ **Zero config** - Just prefix commands with `dotenvx run --`
- ✅ **Works with any tool** - Bun, Node, Vite, etc.

## Security

### ✅ Safe to Commit

- `.env.example` - Template file (no secrets)
- `docs/aws-polly-iam-policy.json` - Public IAM policy

### ❌ NEVER Commit

- `.env` - Contains your secrets
- `.env.local` - Local overrides
- `.env.*.local` - Environment-specific secrets

These are all in `.gitignore`.

### Best Practices

1. **Use minimal IAM permissions** - See [aws-polly-iam-policy.json](./aws-polly-iam-policy.json)
2. **Rotate keys regularly** - Every 90 days
3. **Use IAM roles in production** - Never hardcode keys
4. **Enable CloudTrail** - Monitor API usage
5. **Set billing alerts** - Catch unexpected costs

## Troubleshooting

### Environment variables not loading

**Check**: Are you running scripts from the monorepo root?

```bash
# ✅ Good (from root)
bun run dev:section

# ❌ Bad (from subdirectory)
cd apps/section-demos
bun run dev
```

**Fix**: Always run scripts from the root using `bun run <script>`

### TTS not working

**Check**: Do you have AWS credentials configured?

```bash
# Check if .env exists
ls .env

# Check if variables are set (safe - doesn't show values)
dotenvx run -- env | grep AWS_
```

**Expected output**:
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalr...
```

**Fix**: See [AWS Polly Setup Guide](./aws-polly-setup-guide.md)

### Redis connection errors

**Check**: Is Redis running?

```bash
redis-cli ping
# Should return: PONG
```

**Fix**:
```bash
# macOS
brew services restart redis

# Ubuntu
sudo systemctl restart redis

# Docker
docker restart <redis-container-id>
```

**Note**: The app works without Redis, but caching is disabled.

## Adding New Environment Variables

1. Add to [.env.example](../.env.example) with documentation
2. Add to this document
3. Update relevant package docs if needed

## See Also

- [AWS Polly Setup Guide](./aws-polly-setup-guide.md) - Detailed AWS configuration
- [TTS Architecture](./tts-architecture.md) - How TTS works
- [TTS Integration Guide](../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md) - Server implementation
