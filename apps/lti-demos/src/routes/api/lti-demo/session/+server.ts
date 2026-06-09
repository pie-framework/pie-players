import { json } from "@sveltejs/kit";
import type { AssessmentSessionSnapshot } from "$lib/lti-demo/types";
import {
	deleteAssessmentSessionSnapshot,
	getAssessmentSessionSnapshot,
	isValidSessionKey,
	parseSessionKeyFromSearch,
	saveAssessmentSessionSnapshot,
} from "./db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ url }) => {
	const key = parseSessionKeyFromSearch(url.searchParams);
	if (!isValidSessionKey(key)) {
		return json(
			{ ok: false, error: "assessmentId and attemptId are required" },
			{ status: 400 },
		);
	}
	return json({ ok: true, snapshot: getAssessmentSessionSnapshot(key) });
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as {
		assessmentId?: string;
		attemptId?: string;
		snapshot?: AssessmentSessionSnapshot | null;
	} | null;
	if (!body) {
		return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
	}
	const key = {
		assessmentId: body.assessmentId || "",
		attemptId: body.attemptId || "",
	};
	if (!isValidSessionKey(key)) {
		return json(
			{ ok: false, error: "assessmentId and attemptId are required" },
			{ status: 400 },
		);
	}
	const snapshot = saveAssessmentSessionSnapshot(key, body.snapshot || null);
	return json({ ok: true, snapshot });
};

export const DELETE: RequestHandler = ({ url }) => {
	const key = parseSessionKeyFromSearch(url.searchParams);
	if (!isValidSessionKey(key)) {
		return json(
			{ ok: false, error: "assessmentId and attemptId are required" },
			{ status: 400 },
		);
	}
	deleteAssessmentSessionSnapshot(key);
	return json({ ok: true });
};
