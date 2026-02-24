/**
 * SvelteKit Server Hooks
 *
 * Load environment variables from monorepo root .env file
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

function findUpWithAnchor(startDir: string): string | null {
	let currentDir = startDir;

	while (true) {
		const hasAnchor =
			existsSync(resolve(currentDir, "bun.lock")) ||
			existsSync(resolve(currentDir, ".git"));
		if (hasAnchor) return currentDir;

		const parentDir = resolve(currentDir, "..");
		if (parentDir === currentDir) return null;
		currentDir = parentDir;
	}
}

// Resolve .env via anchor-based upward search across runtime contexts.
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootCandidates = [process.cwd(), __dirname]
	.map((startDir) => findUpWithAnchor(startDir))
	.filter((value): value is string => Boolean(value));
const envCandidates = Array.from(
	new Set(rootCandidates.map((rootDir) => resolve(rootDir, ".env"))),
);
const envPath = envCandidates.find((candidate) => existsSync(candidate));

// Load environment variables when an .env file is present.
const result = envPath ? config({ path: envPath }) : { error: undefined };

if (!envPath) {
	console.warn("[Hooks] Warning: Could not find a .env file.");
	console.warn("[Hooks] Checked paths:", envCandidates.join(", "));
} else if (result.error) {
	console.warn("[Hooks] Warning: Could not load .env file from:", envPath);
	console.warn("[Hooks] Error:", result.error.message);
} else {
	console.log("[Hooks] ✅ Loaded environment variables from:", envPath);
	console.log(
		"[Hooks] AWS_REGION:",
		process.env.AWS_REGION ? "✓ Set" : "✗ Missing",
	);
	console.log(
		"[Hooks] AWS_ACCESS_KEY_ID:",
		process.env.AWS_ACCESS_KEY_ID ? "✓ Set" : "✗ Missing",
	);
	console.log(
		"[Hooks] AWS_SECRET_ACCESS_KEY:",
		process.env.AWS_SECRET_ACCESS_KEY ? "✓ Set" : "✗ Missing",
	);
	console.log(
		"[Hooks] AWS_SESSION_TOKEN:",
		process.env.AWS_SESSION_TOKEN
			? "✓ Set (temporary credentials)"
			: "✗ Not set (long-term credentials)",
	);
}
