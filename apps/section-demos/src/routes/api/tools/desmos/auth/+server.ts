/**
 * Desmos Calculator Auth API Route
 *
 * Returns Desmos API key configuration for client-side calculator initialization.
 * This endpoint should NEVER be exposed in production without proper authentication.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/tools/desmos/auth
 *
 * Response:
 * {
 *   apiKey: string;
 *   config: {
 *     expressionsCollapsed: boolean;
 *     settingsMenu: boolean;
 *     // ... other Desmos config options
 *   }
 * }
 */
export const GET: RequestHandler = async () => {
	try {
		console.log("[Desmos Auth API] Request received");
		console.log(
			"[Desmos Auth API] DESMOS_API_KEY:",
			process.env.DESMOS_API_KEY
				? `✓ Set (${process.env.DESMOS_API_KEY.substring(0, 8)}...)`
				: "✗ Missing",
		);

		// Check for API key
		if (!process.env.DESMOS_API_KEY) {
			console.warn(
				"[Desmos Auth API] API key not configured - calculator will use free tier",
			);

			// Return free tier configuration (no API key)
			return json({
				apiKey: null,
				config: {
					expressionsCollapsed: false,
					settingsMenu: true,
					zoomButtons: true,
					expressionsTopbar: true,
				},
			});
		}

		console.log("[Desmos Auth API] Returning API key configuration");

		// Return API key and configuration
		return json({
			apiKey: process.env.DESMOS_API_KEY,
			config: {
				// Optional: Add default Desmos calculator configuration
				expressionsCollapsed: false,
				settingsMenu: true,
				zoomButtons: true,
				expressionsTopbar: true,
			},
		});
	} catch (err) {
		console.error("[Desmos Auth API] Error:", err);

		if (err instanceof Error) {
			throw error(500, { message: `Desmos auth error: ${err.message}` });
		}

		throw error(500, {
			message: "Desmos auth service encountered an unexpected error.",
		});
	}
};
