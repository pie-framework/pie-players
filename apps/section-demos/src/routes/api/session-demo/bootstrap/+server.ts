import { json } from "@sveltejs/kit";
import {
	clearAllSessionDemoData,
	getSessionDemoState,
	seedSessionDemoData,
} from "../db";
import type { RequestHandler } from "./$types";

export const defaultSeedSections = [
	{
		sectionId: "session-persistence-page-one",
		snapshot: {
			currentItemIndex: 2,
			visitedItemIdentifiers: ["sp1-q1", "sp1-q2", "sp1-q3"],
			itemSessions: {
				"sp1-q1": {
					itemIdentifier: "sp1-q1",
					attemptCount: 1,
					isCompleted: true,
					session: {
						id: "sp1-q1-seeded",
						complete: true,
						data: [{ id: "sp1q1", value: "b" }],
					},
				},
				"sp1-q2": {
					itemIdentifier: "sp1-q2",
					attemptCount: 1,
					isCompleted: false,
					session: {
						id: "sp1-q2-seeded",
						complete: false,
						data: [{ id: "sp1q2", value: "a" }],
					},
				},
				"sp1-q3": {
					itemIdentifier: "sp1-q3",
					attemptCount: 1,
					isCompleted: true,
					session: {
						id: "sp1-q3-seeded",
						complete: true,
						data: [{ id: "sp1q3", value: "b" }],
					},
				},
			},
		},
	},
	{
		sectionId: "session-persistence-page-two",
		snapshot: {
			currentItemIndex: 0,
			visitedItemIdentifiers: ["sp2-q1", "sp2-q2"],
			itemSessions: {
				"sp2-q1": {
					itemIdentifier: "sp2-q1",
					attemptCount: 1,
					isCompleted: true,
					session: {
						id: "sp2-q1-seeded",
						complete: true,
						data: [{ id: "sp2q1", value: "b" }],
					},
				},
				"sp2-q2": {
					itemIdentifier: "sp2-q2",
					attemptCount: 1,
					isCompleted: false,
					persistWhenEmpty: true,
					session: {
						id: "sp2-q2-seeded",
						complete: false,
						data: [],
					},
				},
			},
		},
	},
];

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
