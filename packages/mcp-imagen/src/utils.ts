/**
 * Utility functions for Nano Banana MCP server
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Get platform-aware default output directory
 * Prioritizes docs/img in current working directory if it exists
 */
export function getPlatformDefaultOutputDir(): string {
	// Check if docs/img exists in current working directory
	const docsImgPath = join(process.cwd(), "docs", "img");
	if (existsSync(docsImgPath)) {
		return docsImgPath;
	}

	// Fall back to platform-specific defaults
	if (process.platform === "win32") {
		// Windows: Documents/nano-banana-images
		return join(homedir(), "Documents", "nano-banana-images");
	}
	// macOS/Linux: ~/generated_imgs
	return join(homedir(), "generated_imgs");
}

/**
 * Read image file and convert to base64
 */
export async function imageToBase64(
	imagePath: string,
): Promise<{ data: string; mimeType: string }> {
	const buffer = await readFile(imagePath);
	const data = buffer.toString("base64");

	// Detect MIME type from extension
	const ext = imagePath.toLowerCase().split(".").pop();
	let mimeType = "image/png";

	if (ext === "jpg" || ext === "jpeg") {
		mimeType = "image/jpeg";
	} else if (ext === "webp") {
		mimeType = "image/webp";
	} else if (ext === "gif") {
		mimeType = "image/gif";
	}

	return { data, mimeType };
}

/**
 * Generate timestamp-based filename
 */
export function generateTimestampFilename(
	prefix: string,
	extension = "png",
): string {
	const timestamp = Date.now();
	return `${prefix}-${timestamp}.${extension}`;
}
