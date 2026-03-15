import {
	createSessionDemoSeedPayload,
} from "$lib/demo-runtime/session-demo-db-client";
import { json } from "@sveltejs/kit";
import {
	clearAllSessionDemoData,
	getSessionDemoState,
	seedSessionDemoData,
} from "../db";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		assessmentId?: string;
		attemptId?: string;
		snapshot?: Record<string, unknown>;
		clearOnly?: boolean;
	};
	const assessmentId = body.assessmentId || "";
	const attemptId = body.attemptId || "";
	if (!assessmentId || !attemptId) {
		return json(
			{ ok: false, error: "assessmentId and attemptId are required" },
			{ status: 400 },
		);
	}
	if (body.clearOnly) {
		clearAllSessionDemoData();
	} else {
		const defaultSeed = createSessionDemoSeedPayload(assessmentId, attemptId).snapshot;
		seedSessionDemoData({
			assessmentId,
			attemptId,
			snapshot: (body.snapshot as any) || defaultSeed,
		});
	}
	return json({ ok: true, state: getSessionDemoState() });
};
