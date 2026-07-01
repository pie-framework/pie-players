import { json } from "@sveltejs/kit";
import { getDemoItem, getDemoItemId } from "../../player/db";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		contentId?: string;
		collectionId?: string;
		env?: Record<string, unknown>;
	};
	const contentId = body.contentId || getDemoItemId();
	const item = getDemoItem(contentId);
	if (!item) {
		return json(
			{ error: `Unknown demo contentId: ${contentId}` },
			{ status: 404 },
		);
	}
	return json({
		contentId: item.id,
		collectionId: body.collectionId || "backend-demo-collection",
		config: item.config,
		metadata: {
			source: "backend-demos",
			operation: "authoring.load",
			env: body.env || null,
		},
	});
};
