/**
 * Custom error classes for Imagen MCP server
 */

export class ImagenError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ImagenError";
	}
}

export class AuthenticationError extends ImagenError {
	constructor(message = "Google API key not configured") {
		super(message);
		this.name = "AuthenticationError";
	}
}

export class InvalidPromptError extends ImagenError {
	constructor(message = "Invalid prompt provided") {
		super(message);
		this.name = "InvalidPromptError";
	}
}

export class ImageGenerationError extends ImagenError {
	constructor(message = "Failed to generate image") {
		super(message);
		this.name = "ImageGenerationError";
	}
}

export class ConfigurationError extends ImagenError {
	constructor(message = "Invalid configuration") {
		super(message);
		this.name = "ConfigurationError";
	}
}
