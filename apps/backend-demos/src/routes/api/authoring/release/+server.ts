import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		contentId?: string;
		collectionId?: string;
		env?: Record<string, unknown>;
		options?: {
			releaseType?: string | null;
		};
	};
	if (!body.contentId) {
		return json({ error: "contentId is required" }, { status: 400 });
	}
	return json({
		contentId: body.contentId,
		collectionId: body.collectionId || "backend-demo-collection",
		metadata: {
			source: "backend-demos",
			operation: "authoring.releaseContent",
			releaseType: body.options?.releaseType ?? null,
			releasedAt: new Date().toISOString(),
			env: body.env || null,
		},
	});
};
