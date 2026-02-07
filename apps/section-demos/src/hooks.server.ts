/**
 * SvelteKit Server Hooks
 *
 * Load environment variables from monorepo root .env file
 */

import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Load .env from monorepo root (two levels up from this file)
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const envPath = resolve(__dirname, "../../../../.env");

// Load environment variables
const result = config({ path: envPath });

if (result.error) {
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
