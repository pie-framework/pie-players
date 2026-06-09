import { json } from "@sveltejs/kit";
import { mergeSessionUpdates, runModelControllers } from "../controllers";
import { getDemoItem, getItemForSession, getSession, saveSession } from "../db";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		itemId?: string;
		sessionId?: string;
		data?: unknown[];
		env?: Record<string, unknown>;
	};
	const item = body.itemId
		? getDemoItem(body.itemId)
		: body.sessionId
			? getItemForSession(body.sessionId)
			: null;
	if (!item) {
		return json(
			{ error: "itemId or known sessionId is required" },
			{ status: 400 },
		);
	}
	const session = body.sessionId ? getSession(body.sessionId) : null;
	const sessionData = Array.isArray(body.data)
		? body.data
		: session?.data || [];
	const env = {
		...(body.env || {}),
		mode: "gather",
		role: "student",
	};
	const modelResults = await runModelControllers({
		config: item.config,
		sessionData,
		env,
	});
	const sessionUpdates = modelResults.flatMap(
		(result) => result.sessionUpdates,
	);
	if (session && sessionUpdates.length > 0) {
		saveSession(
			session.id,
			mergeSessionUpdates(sessionData, sessionUpdates),
			item.id,
		);
	}
	return json(
		modelResults.map((result) => result.model),
		{
			headers: {
				"cache-control": "no-store",
			},
		},
	);
};
