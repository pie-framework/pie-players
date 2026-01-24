export type EsmSource = "auto" | "local" | "remote";

// When running in dev mode with Vite plugin, local CDN is same origin (empty string)
export const DEFAULT_LOCAL_ESM_CDN_URL_EMBEDDED = ""; // Empty = same origin
export const DEFAULT_LOCAL_ESM_CDN_URL_STANDALONE = "http://localhost:5179";
export const DEFAULT_REMOTE_ESM_CDN_URL = "https://esm.sh";

export function getDefaultLocalEsmCdnUrl(): string {
	// In browser, check if we're running on the Vite dev server
	if (typeof window !== "undefined") {
		// If we're on a dev server origin, use same origin (embedded mode)
		if (
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1"
		) {
			return DEFAULT_LOCAL_ESM_CDN_URL_EMBEDDED; // Same origin = Vite plugin will handle it
		}
	}
	// Fallback to standalone server URL (e.g., production or custom origin)
	return DEFAULT_LOCAL_ESM_CDN_URL_STANDALONE;
}

export function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, "");
}

export function coerceEsmSource(v: string | null): EsmSource {
	if (v === "local" || v === "remote" || v === "auto") return v;
	return "auto";
}

export async function probeLocalEsmCdn(
	baseUrl: string,
	timeoutMs = 600,
): Promise<boolean> {
	// If baseUrl is empty string, it means embedded mode (same origin via Vite plugin)
	// Always return true since Vite plugin handles it
	if (baseUrl === "") {
		return true;
	}

	// Original probe logic for standalone server
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(`${normalizeBaseUrl(baseUrl)}/health`, {
			method: "GET",
			mode: "cors",
			signal: controller.signal,
		});
		return res.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}
