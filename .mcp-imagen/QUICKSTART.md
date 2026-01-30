# Quick Start Guide

Get started with Imagen MCP server in 3 minutes.

## Step 1: Get Your API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account (make sure you have Gemini Pro access)
3. Click "Get API key" in the sidebar
4. Create a new API key or use an existing one
5. Copy the API key

## Step 2: Setup

Choose one of these methods:

### Method A: Interactive Setup (Recommended)

```bash
cd packages/mcp-imagen
bun run setup
```

Follow the prompts to configure your API key, default model, and output directory.

### Method B: Environment Variable

```bash
export GOOGLE_API_KEY="your-api-key-here"
```

Add this to your `~/.bashrc`, `~/.zshrc`, or `~/.profile` to make it permanent.

## Step 3: Configure MCP

The [.mcp.json](../../.mcp.json) file has already been updated with the Imagen server configuration.

Restart Claude Code or your MCP client to load the new server.

## Step 4: Test It Out

Try generating your first image:

```
Generate an image of a peaceful mountain landscape at sunset
```

The AI will use the `imagen_generate` tool with your prompt.

## Example Commands

### Basic Generation
```
Create an image of a red sports car in a futuristic city
```

### With Specifications
```
Generate 4 images of a cozy coffee shop interior, use the ultra model,
aspect ratio 16:9, and save them to ./my-images
```

### Different Styles
```
Create an oil painting style image of a forest in autumn
```

```
Generate a minimalist logo design for a tech startup, clean and modern
```

```
Create a photorealistic image of a golden retriever puppy playing in grass
```

## Available Models

- **Standard** (`imagen-4.0-generate-001`): Default, balanced quality and speed
- **Ultra** (`imagen-4.0-ultra-generate-001`): Highest quality, slower
- **Fast** (`imagen-4.0-fast-generate-001`): Quick iterations

## Tips for Better Results

1. **Be Descriptive**: Include details about style, lighting, composition, and mood
2. **Specify Style**: Mention art styles like "watercolor", "photograph", "3D render"
3. **Add Context**: Include setting, atmosphere, and technical details
4. **Iterate**: Generate multiple images and refine your prompt
5. **Use Aspect Ratios**: Match the ratio to your intended use (social media, prints, etc.)

## Common Use Cases

### Marketing & Social Media
- Product photography
- Social media posts (use 1:1 or 9:16)
- Website hero images (use 16:9)
- Advertising visuals

### Creative Projects
- Concept art
- Storyboarding
- Character design
- Environment design

### Content Creation
- Blog post illustrations
- Presentation graphics
- Infographic elements
- Video thumbnails

## Troubleshooting

**"No API key configured"**
- Set the `GOOGLE_API_KEY` environment variable or run `bun run setup`

**"Authentication failed"**
- Verify your API key at Google AI Studio
- Check if your account has Imagen access

**Images not as expected**
- Be more specific in your prompt
- Try different models (Standard, Ultra, Fast)
- Generate multiple variations (set numberOfImages to 2-4)
- Adjust aspect ratio to match your needs

## Next Steps

- Read the full [README](README.md) for detailed documentation
- Explore the [Imagen documentation](https://ai.google.dev/gemini-api/docs/imagen)
- Check out [example prompts](https://ai.google.dev/gemini-api/docs/imagen#examples)

## Getting Help

Run `imagen_list_models` to see available models and their capabilities, or check the README for more detailed information.
