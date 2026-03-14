import { json } from "@sveltejs/kit";
import { createSessionDemoSeedPayload } from "$lib/demo-runtime/session-demo-db-client";
import {
	clearAllSessionDemoData,
	getSessionDemoState,
	seedSessionDemoData,
} from "../db";
import type { RequestHandler } from "./$types";

export const defaultSeedSections = createSessionDemoSeedPayload(
	"section-demos-assessment",
	"baseline-seed",
).sections;

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		assessmentId?: string;
		attemptId?: string;
		sections?: Array<{ sectionId: string; snapshot: Record<string, unknown> }>;
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
		const sections =
			Array.isArray(body.sections) && body.sections.length > 0
				? body.sections
				: defaultSeedSections;
		seedSessionDemoData({
			assessmentId,
			attemptId,
			sections: sections.map((entry) => ({
				sectionId: entry.sectionId,
				snapshot: {
					currentItemIndex:
						typeof entry.snapshot?.currentItemIndex === "number"
							? entry.snapshot.currentItemIndex
							: 0,
					visitedItemIdentifiers: Array.isArray(
						entry.snapshot?.visitedItemIdentifiers,
					)
						? (entry.snapshot?.visitedItemIdentifiers as string[])
						: [],
					itemSessions:
						(entry.snapshot?.itemSessions as Record<string, unknown>) || {},
				},
			})),
		});
	}
	return json({ ok: true, state: getSessionDemoState() });
};
