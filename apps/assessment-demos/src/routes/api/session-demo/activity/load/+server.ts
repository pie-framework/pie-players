import { getAssessmentDemoById } from "$lib/content/assessments";
import {
	createSessionDemoSeedPayload,
} from "$lib/demo-runtime/session-demo-db-client";
import { json } from "@sveltejs/kit";
import {
	getAssessmentSnapshot,
	seedSessionDemoData,
	type AssessmentSessionSnapshot,
	type SessionDemoKey,
} from "../../db";
import type { RequestHandler } from "./$types";

function seedIfNeeded(assessmentId: string, attemptId: string, reset: boolean): void {
	const key: SessionDemoKey = {
		assessmentId,
		attemptId,
	};
	if (!reset) {
		const hasSnapshot = Boolean(getAssessmentSnapshot(key));
		if (hasSnapshot) return;
	}
	const seed = createSessionDemoSeedPayload(assessmentId, attemptId);
	seedSessionDemoData({
		assessmentId: seed.assessmentId,
		attemptId: seed.attemptId,
		snapshot: seed.snapshot,
	});
}

function getStats(assessment: Record<string, unknown> | null): {
	totalSections: number;
	totalItems: number;
} {
	if (!assessment) return { totalSections: 0, totalItems: 0 };
	const testParts = Array.isArray((assessment as any).testParts)
		? ((assessment as any).testParts as Array<Record<string, unknown>>)
		: [];
	let totalSections = 0;
	let totalItems = 0;
	for (const part of testParts) {
		const sections = Array.isArray(part.sections)
			? (part.sections as Array<Record<string, unknown>>)
			: [];
		totalSections += sections.length;
		for (const section of sections) {
			const refs = Array.isArray(section.assessmentItemRefs)
				? (section.assessmentItemRefs as Array<Record<string, unknown>>)
				: [];
			totalItems += refs.length;
		}
	}
	return { totalSections, totalItems };
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		assessmentId?: string;
		attemptId?: string;
		reset?: boolean;
	};
	const assessmentId = body.assessmentId || "";
	const attemptId = body.attemptId || "";
	if (!assessmentId || !attemptId) {
		return json(
			{ ok: false, error: "assessmentId and attemptId are required" },
			{ status: 400 },
		);
	}

	seedIfNeeded(assessmentId, attemptId, body.reset === true);
	const key: SessionDemoKey = { assessmentId, attemptId };
	const demo = getAssessmentDemoById("session-hydrate-db");
	const assessment = (demo?.assessment || null) as Record<string, unknown> | null;
	const stats = getStats(assessment);
	const sessionState = getAssessmentSnapshot(key);
	return json({
		ok: true,
		activitySessionId: `assessment-activity-session-${attemptId}`,
		assessment,
		sessionState: sessionState as AssessmentSessionSnapshot | null,
		activityDefinition: {
			sections: assessment ? (((assessment as any).testParts?.[0]?.sections as Array<Record<string, unknown>>) || []) : [],
			stats,
		},
	});
};

export const GET: RequestHandler = async ({ url }) => {
	const assessmentId = url.searchParams.get("assessmentId") || "";
	const attemptId = url.searchParams.get("attemptId") || "";
	if (!assessmentId || !attemptId) {
		return json(
			{ ok: false, error: "assessmentId and attemptId are required" },
			{ status: 400 },
		);
	}
	const key: SessionDemoKey = { assessmentId, attemptId };
	const demo = getAssessmentDemoById("session-hydrate-db");
	const assessment = (demo?.assessment || null) as Record<string, unknown> | null;
	const stats = getStats(assessment);
	return json({
		ok: true,
		activitySessionId: `assessment-activity-session-${attemptId}`,
		assessment,
		sessionState: getAssessmentSnapshot(key),
		activityDefinition: {
			sections: assessment ? (((assessment as any).testParts?.[0]?.sections as Array<Record<string, unknown>>) || []) : [],
			stats,
		},
	});
};
