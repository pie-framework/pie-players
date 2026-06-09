import { json } from "@sveltejs/kit";
import { runOutcomeControllers } from "../controllers";
import { getItemForSession, getSession, saveSession } from "../db";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		sessionId?: string;
		data?: unknown[];
		env?: Record<string, unknown>;
		disablePartialScoring?: boolean;
	};
	if (!body.sessionId) {
		return json({ error: "sessionId is required" }, { status: 400 });
	}
	const existing = getSession(body.sessionId);
	const item = getItemForSession(body.sessionId);
	if (!existing || !item) {
		return json(
			{ error: `Unknown demo sessionId: ${body.sessionId}` },
			{ status: 404 },
		);
	}
	const data = Array.isArray(body.data) ? body.data : existing.data;
	const session = saveSession(body.sessionId, data, item.id);
	const env = {
		...(body.env || {}),
		mode: "evaluate",
		role: "student",
		partialScoring: body.disablePartialScoring === true ? false : true,
	};
	const outcomes = await runOutcomeControllers({
		config: item.config,
		sessionData: session.data,
		env,
	});
	return json(outcomes);
};
