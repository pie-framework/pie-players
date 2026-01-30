# Imagen MCP Server

Model Context Protocol (MCP) server for Google Imagen 4 image generation.

Generate high-quality AI images using Google's latest Imagen 4 models directly from Claude Code, Cursor, or any MCP-compatible client.

## Features

- **Three Imagen 4 Models**: Standard, Ultra, and Fast variants
- **Flexible Generation**: 1-4 images per request
- **Multiple Aspect Ratios**: Square, portrait, and landscape formats
- **Quality Control**: 1K and 2K image sizes
- **Person Generation Control**: Fine-grained control over human depictions
- **Type-Safe**: Built with TypeScript
- **Secure**: API key management with environment variables
- **Fast**: Powered by Bun runtime

## Prerequisites

- [Bun](https://bun.sh) runtime installed
- Google API key with Imagen access from [Google AI Studio](https://aistudio.google.com/)

## Installation

1. Install dependencies:

```bash
cd packages/mcp-imagen
bun install
```

2. Run the setup wizard:

```bash
bun run setup
```

Or manually set your API key:

```bash
export GOOGLE_API_KEY="your-api-key-here"
```

## Configuration

### Option 1: Environment Variable (Recommended)

Set the `GOOGLE_API_KEY` environment variable:

```bash
export GOOGLE_API_KEY="your-api-key-here"
```

### Option 2: Configuration File

The setup wizard creates a config file at `~/.imagen-mcp/config.json`:

```json
{
  "apiKey": "your-api-key-here",
  "defaultModel": "imagen-4.0-generate-001",
  "defaultOutputDir": "/path/to/output"
}
```

### Option 3: MCP Configuration

Add to your [.mcp.json](../../.mcp.json):

```json
{
  "mcpServers": {
    "imagen": {
      "command": "bun",
      "args": ["run", "packages/mcp-imagen/src/index.ts"],
      "env": {
        "GOOGLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Usage

### Available Tools

#### 1. `imagen_generate`

Generate images from text descriptions.

**Parameters:**

- `prompt` (required): Text description of the image to generate
- `model`: Model to use (default: `imagen-4.0-generate-001`)
  - `imagen-4.0-generate-001` - Standard quality
  - `imagen-4.0-ultra-generate-001` - Ultra quality
  - `imagen-4.0-fast-generate-001` - Fast generation
- `numberOfImages`: Number of images to generate (1-4, default: 1)
- `aspectRatio`: Image aspect ratio (default: `1:1`)
  - `1:1` - Square
  - `3:4` - Portrait
  - `4:3` - Landscape
  - `9:16` - Tall portrait
  - `16:9` - Wide landscape
- `imageSize`: Image resolution (default: `1K`)
  - `1K` - 1024px
  - `2K` - 2048px (not available on fast model)
- `personGeneration`: Control people in images (default: `allow_adult`)
  - `dont_allow` - No people
  - `allow_adult` - Adults only
  - `allow_all` - All ages
- `outputDir`: Directory to save images (default: current directory)
- `outputPrefix`: Filename prefix (default: `imagen`)

**Example:**

```typescript
{
  "prompt": "A serene mountain landscape at sunset with a lake reflection",
  "model": "imagen-4.0-generate-001",
  "numberOfImages": 2,
  "aspectRatio": "16:9",
  "imageSize": "2K",
  "outputDir": "./generated-images"
}
```

#### 2. `imagen_list_models`

Get information about available Imagen 4 models and their capabilities.

### Example Prompts

**Photography Style:**
```
A professional photograph of a modern coffee shop interior,
warm lighting, wooden furniture, plants, cozy atmosphere,
shot with a wide-angle lens
```

**Artistic Style:**
```
An oil painting of a peaceful Japanese garden with cherry
blossoms, koi pond, and stone lanterns, impressionist style
```

**Illustration Style:**
```
A cute cartoon illustration of a robot chef making pizza,
vibrant colors, friendly expression, children's book style
```

**Product Visualization:**
```
A high-end product photograph of a smartwatch on a marble
surface, studio lighting, reflections, commercial photography
```

## Model Selection Guide

### Standard (`imagen-4.0-generate-001`)
- **Best for**: General-purpose image generation
- **Quality**: High
- **Speed**: Medium
- **Supports**: 1K and 2K sizes
- **Use when**: Balanced quality and speed needed

### Ultra (`imagen-4.0-ultra-generate-001`)
- **Best for**: Professional, high-quality outputs
- **Quality**: Highest
- **Speed**: Slower
- **Supports**: 1K and 2K sizes
- **Use when**: Maximum quality is required

### Fast (`imagen-4.0-fast-generate-001`)
- **Best for**: Quick iterations and prototyping
- **Quality**: Good
- **Speed**: Fastest
- **Supports**: Fixed size only (imageSize parameter ignored)
- **Use when**: Speed is priority or testing prompts

## Important Notes

1. **Language**: Imagen supports English-only prompts (max 480 tokens)
2. **Watermark**: All generated images include a SynthID watermark
3. **Prompt Length**: Keep prompts under 480 tokens for best results
4. **Rate Limits**: Subject to Google AI Studio API rate limits
5. **Costs**: Check Google AI Studio pricing for current rates

## Troubleshooting

### "Google API key not configured"

Make sure you've set the `GOOGLE_API_KEY` environment variable or run `bun run setup`.

### "Authentication failed"

Verify your API key is valid at [Google AI Studio](https://aistudio.google.com/). You may need to:
- Enable the Imagen API in your Google Cloud project
- Check your API key has correct permissions
- Verify your account has access to Imagen models

### "Prompt is too long"

Reduce your prompt to under 480 tokens (roughly 300-400 words).

### Images not generating

Check:
- API key is valid and has access to Imagen
- Network connectivity
- Google AI Studio status page
- Prompt doesn't violate content policies

## Development

### Run in Development Mode

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Environment Variables

- `GOOGLE_API_KEY` - Your Google API key (required)
- `LOG_LEVEL` - Logging level: `error`, `warn`, `info`, `debug` (default: `info`)

## Architecture

```
packages/mcp-imagen/
├── src/
│   ├── index.ts          # Entry point and CLI
│   ├── server.ts         # MCP server implementation
│   ├── client.ts         # Google Imagen API client
│   ├── config.ts         # Configuration management
│   ├── setup.ts          # Interactive setup wizard
│   ├── types.ts          # TypeScript type definitions
│   ├── errors.ts         # Custom error classes
│   └── logger.ts         # Structured logging
├── package.json
├── tsconfig.json
└── README.md
```

## API Reference

### ImagenClient

```typescript
class ImagenClient {
  constructor(apiKey: string)

  async generateImages(options: GenerateImageOptions): Promise<GenerateImageResult>
  async testConnection(): Promise<boolean>
}
```

### Types

```typescript
type ImagenModel =
  | 'imagen-4.0-generate-001'
  | 'imagen-4.0-ultra-generate-001'
  | 'imagen-4.0-fast-generate-001';

type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
type ImageSize = '1K' | '2K';
type PersonGeneration = 'dont_allow' | 'allow_adult' | 'allow_all';

interface GenerateImageOptions {
  prompt: string;
  model?: ImagenModel;
  numberOfImages?: number;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  personGeneration?: PersonGeneration;
  outputDir?: string;
  outputPrefix?: string;
}
```

## Resources

- [Google AI Studio](https://aistudio.google.com/) - Get your API key
- [Imagen Documentation](https://ai.google.dev/gemini-api/docs/imagen) - Official API docs
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [Examples Gallery](https://ai.google.dev/gemini-api/docs/imagen#examples) - Prompt examples

## License

MIT

## Support

For issues and questions:
- Check the [troubleshooting section](#troubleshooting)
- Review [Google's Imagen documentation](https://ai.google.dev/gemini-api/docs/imagen)
- Open an issue in this repository
