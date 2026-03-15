import { json } from "@sveltejs/kit";
import {
	deleteAssessmentSnapshot,
	getAssessmentSnapshot,
	isValidSessionDemoKey,
	parseSessionDemoKeyFromSearch,
	upsertAssessmentSnapshot,
} from "../db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const key = parseSessionDemoKeyFromSearch(url.searchParams);
	if (!isValidSessionDemoKey(key)) {
		return json(
			{ ok: false, error: "assessmentId and attemptId are required" },
			{ status: 400 },
		);
	}
	return json({ ok: true, snapshot: getAssessmentSnapshot(key) });
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as
		| {
				assessmentId?: string;
				attemptId?: string;
				snapshot?: Record<string, unknown>;
		  }
		| null;
	if (!body) {
		return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
	}
	const key = {
		assessmentId: body.assessmentId || "",
		attemptId: body.attemptId || "",
	};
	if (!isValidSessionDemoKey(key)) {
		return json(
			{ ok: false, error: "assessmentId and attemptId are required" },
			{ status: 400 },
		);
	}
	upsertAssessmentSnapshot(key, body.snapshot || {});
	return json({ ok: true, snapshot: getAssessmentSnapshot(key) });
};

export const DELETE: RequestHandler = async ({ url }) => {
	const key = parseSessionDemoKeyFromSearch(url.searchParams);
	if (!isValidSessionDemoKey(key)) {
		return json(
			{ ok: false, error: "assessmentId and attemptId are required" },
			{ status: 400 },
		);
	}
	deleteAssessmentSnapshot(key);
	return json({ ok: true });
};
