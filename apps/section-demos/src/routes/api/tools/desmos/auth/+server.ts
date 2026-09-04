/**
 * Desmos Calculator Auth API Route
 *
 * Returns the demo host's Desmos API key for client-side calculator loading.
 * The key is necessarily visible to the browser in Desmos's documented CDN URL.
 * This route keeps it out of source/static bundles; it is not a secret boundary.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/tools/desmos/auth
 *
 * Response: { apiKey: string }
 */
export const GET: RequestHandler = async () => {
	const headers = {
		"cache-control": "private, no-store",
		pragma: "no-cache",
	};
	const apiKey = process.env.DESMOS_API_KEY?.trim();
	if (!apiKey) {
		console.warn(
			"[Desmos Auth API] DESMOS_API_KEY is not configured; preserving the legacy unkeyed demo path. This does not grant a Desmos license.",
		);
		return json({ apiKey: null, compatibilityMode: true }, { headers });
	}

	return json({ apiKey }, { headers });
};
