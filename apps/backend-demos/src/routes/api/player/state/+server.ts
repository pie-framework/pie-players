import { json } from "@sveltejs/kit";
import { getDemoState, getSession } from "../db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const sessionId = url.searchParams.get("sessionId");
	if (sessionId) {
		return json({ session: getSession(sessionId) });
	}
	return json(getDemoState());
};
