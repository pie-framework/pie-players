/**
 * MCP Server for Nano Banana (Gemini Image Generation)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { NanoBananaClient } from "./client.js";
import { configManager } from "./config.js";
import { AuthenticationError, ImagenError } from "./errors.js";
import { logger } from "./logger.js";
import type {
	ContinueEditingOptions,
	EditImageOptions,
	GenerateImageOptions,
} from "./types.js";

export class NanoBananaMcpServer {
	private server: McpServer;
	private client: NanoBananaClient | null = null;

	constructor() {
		this.server = new McpServer(
			{
				name: "nanobanana-mcp",
				version: "0.2.0",
			},
			{
				capabilities: {
					tools: {},
				},
			},
		);

		this.setupHandlers();
	}

	private async getClient(): Promise<NanoBananaClient> {
		if (!this.client) {
			const apiKey = configManager.getApiKey();
			if (!apiKey) {
				throw new AuthenticationError(
					"Google API key not configured. Set GOOGLE_API_KEY environment variable or use nanobanana_configure tool.",
				);
			}
			this.client = new NanoBananaClient(apiKey);
		}
		return this.client;
	}

	private setupHandlers(): void {
		// List available tools
		this.server.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: [
					{
						name: "nanobanana_generate",
						description: `Generate images using Nano Banana - Gemini's native image generation AI.

Nano Banana is Google's playful name for Gemini's image generation capabilities.

**Models**:
- **Nano Banana Pro** (gemini-3-pro-image-preview): Professional quality with advanced reasoning
- **Nano Banana** (gemini-2.5-flash-image): Fast generation for quick iterations

Returns: List of generated image file paths and metadata.`,
						inputSchema: {
							type: "object",
							properties: {
								prompt: {
									type: "string",
									description: "Detailed description of the image to generate",
								},
								model: {
									type: "string",
									enum: [
										"gemini-3-pro-image-preview",
										"gemini-2.5-flash-image",
									],
									description:
										"Model to use (default: gemini-3-pro-image-preview)",
									default: "gemini-3-pro-image-preview",
								},
								numberOfImages: {
									type: "number",
									minimum: 1,
									maximum: 4,
									description: "Number of images to generate (default: 1)",
									default: 1,
								},
								outputDir: {
									type: "string",
									description:
										"Directory to save images (default: platform-specific)",
								},
								outputPrefix: {
									type: "string",
									description:
										"Prefix for output filenames (default: nanobanana)",
									default: "nanobanana",
								},
							},
							required: ["prompt"],
						},
					},
					{
						name: "nanobanana_edit",
						description: `Edit an existing image using text instructions with Nano Banana.

Supports:
- Modifying existing images with natural language instructions
- Style transfer with optional reference images
- Object addition/removal, color changes, style modifications

Returns: Path to the edited image.`,
						inputSchema: {
							type: "object",
							properties: {
								imagePath: {
									type: "string",
									description: "Path to the image file to edit",
								},
								prompt: {
									type: "string",
									description: "Instructions for editing the image",
								},
								model: {
									type: "string",
									enum: [
										"gemini-3-pro-image-preview",
										"gemini-2.5-flash-image",
									],
									description:
										"Model to use (default: gemini-3-pro-image-preview)",
									default: "gemini-3-pro-image-preview",
								},
								referenceImages: {
									type: "array",
									items: { type: "string" },
									description: "Optional reference images for style guidance",
								},
								outputDir: {
									type: "string",
									description:
										"Directory to save edited image (default: platform-specific)",
								},
								outputPrefix: {
									type: "string",
									description: "Prefix for output filename (default: edited)",
									default: "edited",
								},
							},
							required: ["imagePath", "prompt"],
						},
					},
					{
						name: "nanobanana_continue_editing",
						description: `Continue editing the last generated or edited image.

Perfect for iterative workflows where you want to refine an image step by step.
Uses the most recently generated/edited image automatically.

Returns: Path to the newly edited image.`,
						inputSchema: {
							type: "object",
							properties: {
								prompt: {
									type: "string",
									description: "Instructions for continuing the edit",
								},
								model: {
									type: "string",
									enum: [
										"gemini-3-pro-image-preview",
										"gemini-2.5-flash-image",
									],
									description:
										"Model to use (default: gemini-3-pro-image-preview)",
									default: "gemini-3-pro-image-preview",
								},
								outputDir: {
									type: "string",
									description:
										"Directory to save edited image (default: platform-specific)",
								},
								outputPrefix: {
									type: "string",
									description:
										"Prefix for output filename (default: continued)",
									default: "continued",
								},
							},
							required: ["prompt"],
						},
					},
					{
						name: "nanobanana_get_last_image",
						description: `Get information about the last generated or edited image.

Useful for tracking the current state in iterative workflows.

Returns: Path, prompt, timestamp, and model used for the last image.`,
						inputSchema: {
							type: "object",
							properties: {},
						},
					},
					{
						name: "nanobanana_configure",
						description: `Configure the Google API key at runtime without restarting.

Allows updating the API key dynamically. Useful for switching between different API keys or initial setup.

Returns: Confirmation message.`,
						inputSchema: {
							type: "object",
							properties: {
								apiKey: {
									type: "string",
									description:
										"Your Google API key from https://aistudio.google.com/",
								},
							},
							required: ["apiKey"],
						},
					},
					{
						name: "nanobanana_list_models",
						description: `List available Nano Banana models with their capabilities.

Returns comprehensive information about Pro and Fast variants, use cases, and recommendations.`,
						inputSchema: {
							type: "object",
							properties: {},
						},
					},
				],
			};
		});

		// Handle tool calls
		this.server.server.setRequestHandler(
			CallToolRequestSchema,
			async (request) => {
				try {
					const { name, arguments: args } = request.params;

					switch (name) {
						case "nanobanana_generate":
							return await this.handleGenerateImage(
								args as unknown as GenerateImageOptions,
							);

						case "nanobanana_edit":
							return await this.handleEditImage(
								args as unknown as EditImageOptions,
							);

						case "nanobanana_continue_editing":
							return await this.handleContinueEditing(
								args as unknown as ContinueEditingOptions,
							);

						case "nanobanana_get_last_image":
							return await this.handleGetLastImage();

						case "nanobanana_configure":
							return await this.handleConfigure(args as { apiKey: string });

						case "nanobanana_list_models":
							return this.handleListModels();

						default:
							throw new Error(`Unknown tool: ${name}`);
					}
				} catch (error) {
					logger.error("Tool execution failed", {
						error,
						tool: request.params.name,
					});

					if (error instanceof ImagenError) {
						return {
							content: [
								{
									type: "text",
									text: `Error: ${error.message}`,
								},
							],
							isError: true,
						};
					}

					return {
						content: [
							{
								type: "text",
								text: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
						isError: true,
					};
				}
			},
		);
	}

	private async handleGenerateImage(args: GenerateImageOptions) {
		logger.info("Handling nanobanana_generate tool call", { args });

		const client = await this.getClient();
		const result = await client.generateImages(args);

		const imageList = result.images
			.map(
				(img, idx) =>
					`${idx + 1}. ${img.filename}\n   Path: ${img.path}\n   Size: ${(img.sizeBytes / 1024).toFixed(2)} KB`,
			)
			.join("\n\n");

		const modelName =
			result.model === "gemini-3-pro-image-preview"
				? "Nano Banana Pro 🍌"
				: "Nano Banana 🍌";

		return {
			content: [
				{
					type: "text",
					text: `✓ Successfully generated ${result.images.length} image(s) with ${modelName}

Prompt: ${result.prompt}

Generated Images:
${imageList}

Generated with ${modelName} - Gemini's native image generation AI.`,
				},
			],
		};
	}

	private async handleEditImage(args: EditImageOptions) {
		logger.info("Handling nanobanana_edit tool call", { args });

		const client = await this.getClient();
		const result = await client.editImage(args);

		const modelName =
			result.model === "gemini-3-pro-image-preview"
				? "Nano Banana Pro 🍌"
				: "Nano Banana 🍌";

		return {
			content: [
				{
					type: "text",
					text: `✓ Successfully edited image with ${modelName}

Edit Instructions: ${result.prompt}
Original Image: ${result.originalImage}

Edited Image:
- Filename: ${result.image.filename}
- Path: ${result.image.path}
- Size: ${(result.image.sizeBytes / 1024).toFixed(2)} KB

Edited with ${modelName} - Gemini's native image generation AI.`,
				},
			],
		};
	}

	private async handleContinueEditing(args: ContinueEditingOptions) {
		logger.info("Handling nanobanana_continue_editing tool call", { args });

		const client = await this.getClient();
		const result = await client.continueEditing(args);

		const modelName =
			result.model === "gemini-3-pro-image-preview"
				? "Nano Banana Pro 🍌"
				: "Nano Banana 🍌";

		return {
			content: [
				{
					type: "text",
					text: `✓ Successfully continued editing with ${modelName}

Edit Instructions: ${result.prompt}
Previous Image: ${result.originalImage}

New Image:
- Filename: ${result.image.filename}
- Path: ${result.image.path}
- Size: ${(result.image.sizeBytes / 1024).toFixed(2)} KB

Edited with ${modelName} - Gemini's native image generation AI.`,
				},
			],
		};
	}

	private async handleGetLastImage() {
		logger.info("Handling nanobanana_get_last_image tool call");

		const client = await this.getClient();
		const lastImage = client.getLastImageInfo();

		if (!lastImage) {
			return {
				content: [
					{
						type: "text",
						text: "No image has been generated or edited yet.\n\nUse nanobanana_generate to create a new image first.",
					},
				],
			};
		}

		const date = new Date(lastImage.timestamp);
		const modelName =
			lastImage.model === "gemini-3-pro-image-preview"
				? "Nano Banana Pro"
				: "Nano Banana";

		return {
			content: [
				{
					type: "text",
					text: `Last Image Information:

Path: ${lastImage.path}
Prompt: ${lastImage.prompt}
Model: ${modelName}
Timestamp: ${date.toLocaleString()}

You can use nanobanana_continue_editing to further refine this image.`,
				},
			],
		};
	}

	private async handleConfigure(args: { apiKey: string }) {
		logger.info("Handling nanobanana_configure tool call");

		const { apiKey } = args;

		if (!apiKey || apiKey.trim().length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "Error: API key cannot be empty.\n\nGet your API key from: https://aistudio.google.com/",
					},
				],
				isError: true,
			};
		}

		// Update the API key in config manager
		await configManager.save({ apiKey });

		// Update the client
		if (this.client) {
			this.client.updateApiKey(apiKey);
		} else {
			// Create new client
			this.client = new NanoBananaClient(apiKey);
		}

		return {
			content: [
				{
					type: "text",
					text: `✓ API key configured successfully!

The new API key has been saved and is now active.
You can start generating images immediately.

Try: nanobanana_generate with a creative prompt!`,
				},
			],
		};
	}

	private handleListModels() {
		logger.info("Handling nanobanana_list_models tool call");

		return {
			content: [
				{
					type: "text",
					text: `# Nano Banana 🍌 - Gemini Image Generation Models

Nano Banana is the playful name for Gemini's native image generation capabilities. Two models are available:

## 1. Nano Banana Pro (gemini-3-pro-image-preview)
- **Quality**: Studio-quality, professional grade
- **Speed**: Moderate (optimized for quality)
- **Reasoning**: Advanced reasoning for complex prompts
- **Control**: High precision and control over results
- **Best For**:
  - Professional marketing materials
  - Detailed artwork and illustrations
  - Complex compositions requiring reasoning
  - High-fidelity product visualization
  - Creative projects with specific requirements

## 2. Nano Banana (gemini-2.5-flash-image)
- **Quality**: Good, suitable for most use cases
- **Speed**: Very fast
- **Optimization**: High-volume, low-latency tasks
- **Efficiency**: Excellent for rapid iteration
- **Best For**:
  - Social media content
  - Rapid prototyping and ideation
  - Quick iterations and variations
  - High-volume content generation
  - Testing and experimentation

## Key Features (Both Models)

### Conversational Understanding
- Use natural language descriptions
- No need for technical prompt engineering
- Understands context and intent

### Multimodal Capabilities
- Generate images from text
- Edit existing images with text instructions
- Understand combinations of text and images
- Process complex, multi-part requests

### Smart Reasoning
- Interprets creative direction
- Handles abstract concepts
- Understands composition and aesthetics
- Can infer missing details

## Choosing the Right Model

**Use Nano Banana Pro when**:
- Quality is paramount
- Working on client deliverables
- Creating final production assets
- Need specific technical requirements
- Generating marketing or commercial content

**Use standard Nano Banana when**:
- Speed matters more than perfection
- Generating social media posts
- Brainstorming and ideation
- Creating multiple variations quickly
- Budget-conscious projects with volume needs

## Example Prompts

### Natural Language (Nano Banana excels at this)
\`\`\`
Create a warm and inviting coffee shop scene with morning sunlight
streaming through large windows
\`\`\`

### Specific Details (Nano Banana Pro shines here)
\`\`\`
Professional product photography of a sleek smartwatch on a marble surface,
studio lighting with soft shadows, 45-degree angle, shallow depth of field,
modern and minimalist aesthetic
\`\`\`

### Creative Concepts
\`\`\`
An astronaut planting flowers on Mars, whimsical and colorful,
children's book illustration style
\`\`\`

### Abstract Ideas
\`\`\`
The feeling of nostalgia, represented through warm autumn colors
and vintage photography aesthetic
\`\`\`

## Tips for Best Results

1. **Be Descriptive**: Include mood, style, lighting, and composition
2. **Use Natural Language**: Don't worry about prompt formatting tricks
3. **Specify Style**: Mention artistic styles (watercolor, photorealistic, etc.)
4. **Iterate**: Use continue_editing to refine your images
5. **Trust the AI**: Nano Banana's reasoning can interpret creative direction

Nano Banana is part of Gemini's conversational AI, making image generation as easy as describing what you want to see!`,
				},
			],
		};
	}

	async start(): Promise<void> {
		try {
			// Load configuration
			await configManager.load();
			logger.info("Configuration loaded");

			// Verify API key is present (but don't fail if not - can be set via configure tool)
			const apiKey = configManager.getApiKey();
			if (!apiKey) {
				logger.warn(
					"No API key configured. Use nanobanana_configure tool to set it up.",
				);
			} else {
				logger.info("API key configured");
			}

			// Start server with stdio transport
			const transport = new StdioServerTransport();
			await this.server.connect(transport);

			logger.info("Nano Banana MCP server started successfully");
		} catch (error) {
			logger.error("Failed to start server", { error });
			throw error;
		}
	}

	async stop(): Promise<void> {
		try {
			await this.server.close();
			logger.info("Nano Banana MCP server stopped");
		} catch (error) {
			logger.error("Error stopping server", { error });
			throw error;
		}
	}
}
