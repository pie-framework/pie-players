/**
 * Serves a stub picture as SVG.
 *
 * The glyph is drawn as text inside the SVG, so the demo needs no binary assets and no
 * licensed symbol set checked into the repo.
 */

import { error } from "@sveltejs/kit";
import { findPicture } from "../../corpus";
import type { RequestHandler } from "./$types";

/** Escape for text content inside SVG. The slug is untrusted route input. */
function escapeXml(value: string): string {
	return value
		.replace(/&/gu, "&amp;")
		.replace(/</gu, "&lt;")
		.replace(/>/gu, "&gt;")
		.replace(/"/gu, "&quot;");
}

export const GET: RequestHandler = async ({ params }) => {
	const slug = (params.slug ?? "").replace(/\.svg$/u, "");
	const picture = findPicture(slug);
	if (!picture) throw error(404, { message: "No such stub picture." });

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="${escapeXml(picture.caption)}"><rect width="96" height="96" rx="8" fill="#f3f4f6"/><text x="48" y="62" font-size="44" text-anchor="middle">${escapeXml(picture.glyph)}</text></svg>`;

	return new Response(svg, {
		headers: {
			"content-type": "image/svg+xml",
			// Demo asset; a real service returns short-lived signed URLs instead.
			"cache-control": "public, max-age=60",
		},
	});
};
