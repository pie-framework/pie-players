import { json } from "@sveltejs/kit";
import { runModelControllers } from "../controllers";
import { getDemoItem, getItemForSession, getSession } from "../db";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		itemId?: string;
		sessionId?: string;
		data?: unknown[];
		env?: Record<string, unknown>;
		models?: Array<{ id?: unknown; element?: unknown }>;
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
	const currentModelElements = new Map(
		(body.models || []).flatMap((model) =>
			typeof model.id === "string" && typeof model.element === "string"
				? [[model.id, model.element] as const]
				: [],
		),
	);
	const models = modelResults.map((result) => {
		const currentElement =
			typeof result.model.id === "string"
				? currentModelElements.get(result.model.id)
				: undefined;
		return currentElement
			? { ...result.model, element: currentElement }
			: result.model;
	});
	return json(models, {
		headers: {
			"cache-control": "no-store",
		},
	});
};
