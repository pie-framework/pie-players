/**
 * Picture dictionary lookup stub for the demos.
 *
 * PIE ships no endpoint and no corpus — the symbol set behind a picture dictionary is
 * licensed — so this exists so the tool's states (a hit, a miss, a failure) are
 * reachable in the demo app and in e2e.
 */

import { json } from "@sveltejs/kit";
import { PICTURES } from "./corpus";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, url }) => {
	const body = (await request.json().catch(() => ({}))) as {
		keyword?: unknown;
		max?: unknown;
	};
	const keyword =
		typeof body.keyword === "string" ? body.keyword.trim().toLowerCase() : "";

	// A reserved word for driving the error state, so the demo and e2e can reach it
	// without taking the dev server down.
	if (keyword === "servicefailure") {
		return json(
			{ message: "Simulated picture dictionary failure." },
			{ status: 503 },
		);
	}

	const found = PICTURES[keyword];
	if (!found) return json({ pictures: [] });

	const max = typeof body.max === "number" && body.max > 0 ? body.max : 4;
	return json({
		pictures: found.slice(0, max).map((picture, index) => ({
			// Same-origin path, which is the shape the tool accepts alongside https:. A
			// signed object-storage URL is the real-world equivalent; a data: URI is not,
			// and the tool refuses those.
			url: `${url.pathname}/glyph/${encodeURIComponent(keyword)}-${index}.svg`,
			caption: picture.caption,
			width: 96,
			height: 96,
		})),
	});
};
