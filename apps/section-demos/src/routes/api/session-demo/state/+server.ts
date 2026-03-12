import { json } from "@sveltejs/kit";
import { getSessionDemoState } from "../db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	return json({ ok: true, state: getSessionDemoState() });
};
