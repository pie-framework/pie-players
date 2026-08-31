import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { readStoredFile } from "$lib/server/authoring-media-store";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".mp3": "audio/mpeg",
	".m4a": "audio/mp4",
	".wav": "audio/wav",
	".webm": "audio/webm",
	".ogg": "audio/ogg",
};

// An SVG served as image/svg+xml from this app's own origin executes its
// scripts when navigated to directly, so an upload would be stored XSS against
// the demo. `sandbox` with no allowances stops that: the document gets an
// opaque origin and no script execution. It does not affect `<img src>`, which
// is how authored markup renders the file and which never ran scripts anyway.
// Authored SVG rendered *inside* the player goes through `sanitizeItemMarkup`;
// this route serves bytes straight from disk and never reaches that path.
const SANDBOXED_EXTENSIONS = new Set([".svg"]);

function extensionOf(fileName: string): string {
	return fileName.includes(".")
		? `.${fileName.split(".").pop()?.toLowerCase() || ""}`
		: "";
}

export const GET: RequestHandler = async ({ params }) => {
	const name = params.name;
	if (!name) {
		throw error(400, "Missing file name.");
	}
	const bytes = await readStoredFile(name);
	if (!bytes) {
		throw error(404, "Media file not found.");
	}
	const ext = extensionOf(name);
	const contentType =
		CONTENT_TYPE_BY_EXTENSION[ext] || "application/octet-stream";
	const headers: Record<string, string> = {
		"cache-control": "no-store",
		"content-type": contentType,
		// The fallback above is deliberately inert, and sniffing would undo it.
		"x-content-type-options": "nosniff",
	};
	if (SANDBOXED_EXTENSIONS.has(ext)) {
		headers["content-security-policy"] = "sandbox";
	}
	const normalizedBytes = Uint8Array.from(bytes);
	return new Response(new Blob([normalizedBytes], { type: contentType }), {
		headers,
	});
};
