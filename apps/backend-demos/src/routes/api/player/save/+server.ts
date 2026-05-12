import { json } from "@sveltejs/kit";
import { saveSession } from "../db";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		sessionId?: string;
		itemId?: string;
		data?: unknown[];
	};
	if (!body.sessionId) {
		return json({ error: "sessionId is required" }, { status: 400 });
	}
	let session;
	try {
		session = saveSession(
			body.sessionId,
			Array.isArray(body.data) ? body.data : [],
			body.itemId,
		);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : String(error) },
			{ status: 409 },
		);
	}
	return json({ ok: true, session });
};
