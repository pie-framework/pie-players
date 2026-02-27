# Getting Started with PIE Players

Quick start guide for running the PIE Players demos with all features enabled.

## Prerequisites

- [Bun](https://bun.sh) >= 1.1.0 (package manager)
- Node.js >= 18 (for some dependencies)
- (Optional) AWS account for Text-to-Speech
- (Optional) Redis for TTS caching

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment (Optional)

For server-side Text-to-Speech with speech marks:

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your AWS credentials
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=AKIA...
# AWS_SECRET_ACCESS_KEY=wJalr...
```

**Setup guide**: [docs/aws-polly-setup-guide.md](docs/aws-polly-setup-guide.md)

### 3. Build Packages

```bash
bun run build
```

### 4. Run Demo

```bash
bun run dev:section
```

Open http://localhost:5173

## Features to Try

### Text-to-Speech Demo

1. Navigate to **Toolkit Preview** → **Text-to-Speech Demo**
2. Select provider (Server TTS or Browser TTS)
3. Click "Speak" to hear sample text with word highlighting

**Server TTS** (requires AWS credentials):
- ✅ Millisecond-precise word highlighting
- ✅ High-quality neural voices
- ✅ Consistent across all browsers

**Browser TTS** (always available):
- ✅ Works offline
- ✅ No configuration needed
- ⚠️ Word highlighting unreliable (browser limitations)

### Assessment Toolkit Preview

Browse all PIE element types with various accessibility profiles:

1. Navigate to **Toolkit Preview**
2. Select an element type (Multiple Choice, Essay, etc.)
3. Try different profiles (IEP, 504, ELL)
4. Use accessibility tools (TTS, Calculator, Highlighter)

## Project Structure

```
pie-players/
├── apps/
│   ├── example/          # Main demo application
│   ├── section-demos/    # Section player demos
│   └── docs/            # Documentation site
├── packages/
│   ├── assessment-toolkit/    # Assessment runtime
│   ├── section-player/        # Section player component
│   ├── tts-server-polly/      # AWS Polly TTS (server)
│   ├── tts-client-server/     # TTS client (browser)
│   └── ...                    # Other packages
└── docs/                 # Documentation
```

## Scripts

### Development

```bash
bun run dev:section     # Run section demo
bun run dev:docs        # Run documentation site
bun run dev:demo        # Serve packages locally
```

### Build

```bash
bun run build          # Build all packages
bun run typecheck      # Type check all packages
bun run check          # Svelte check all packages
```

### Testing

```bash
bun run test           # Run all tests
```

### Linting

```bash
bun run lint           # Lint all packages
bun run lint:fix       # Fix linting issues
bun run format         # Format code
```

## Common Issues

### "AWS credentials not configured"

**Solution**: Add AWS credentials to `.env`. See [AWS Polly Setup Guide](docs/aws-polly-setup-guide.md).

**Workaround**: Use Browser TTS (no credentials needed).

### "Module not found" errors

**Solution**: Rebuild packages:
```bash
bun run build
```

### Changes not reflecting

**Solution**:
1. Stop dev server (Ctrl+C)
2. Clean build artifacts: `bun run clean`
3. Rebuild: `bun run build`
4. Restart: `bun run dev:section`

## Documentation

### Quick References
- [Environment Setup](docs/environment-setup.md) - Environment variables
- [AWS Polly Setup](docs/aws-polly-setup-guide.md) - TTS credentials

### Architecture
- [TTS Architecture](docs/tts-architecture.md) - Text-to-Speech system
- [TTS Synchronization Best Practices](docs/tts-synchronization-best-practices.md) - Runtime behavior details

### Integration Guides
- [TTS Server API Integration](packages/tts-server-polly/examples/INTEGRATION-GUIDE.md) - Server-side TTS
- [Accessibility Catalogs](docs/accessibility-catalogs-integration-guide.md) - QTI 3.0 catalogs

## Need Help?

1. Check the [docs/](docs/) directory for guides
2. Look for `README.md` files in each package
3. Open an issue on GitHub

## License

MIT
