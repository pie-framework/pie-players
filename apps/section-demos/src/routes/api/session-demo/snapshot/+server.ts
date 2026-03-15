import { json } from "@sveltejs/kit";
import {
	deleteSectionSnapshot,
	getSectionSnapshot,
	isValidSessionDemoKey,
	parseSessionDemoKeyFromSearch,
	upsertSectionSnapshot,
} from "../db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const key = parseSessionDemoKeyFromSearch(url.searchParams);
	if (!isValidSessionDemoKey(key)) {
		return json(
			{ ok: false, error: "assessmentId, sectionId, and attemptId are required" },
			{ status: 400 },
		);
	}
	return json({ ok: true, snapshot: getSectionSnapshot(key) });
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as
		| {
				assessmentId?: string;
				sectionId?: string;
				attemptId?: string;
				snapshot?: {
					currentItemIndex?: number;
					visitedItemIdentifiers?: string[];
					itemSessions?: Record<string, unknown>;
				};
		  }
		| null;
	if (!body) {
		return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
	}
	const key = {
		assessmentId: body.assessmentId || "",
		sectionId: body.sectionId || "",
		attemptId: body.attemptId || "",
	};
	if (!isValidSessionDemoKey(key)) {
		return json(
			{ ok: false, error: "assessmentId, sectionId, and attemptId are required" },
			{ status: 400 },
		);
	}
	upsertSectionSnapshot(key, {
		currentItemIndex:
			typeof body.snapshot?.currentItemIndex === "number"
				? body.snapshot.currentItemIndex
				: 0,
		visitedItemIdentifiers: Array.isArray(body.snapshot?.visitedItemIdentifiers)
			? body.snapshot?.visitedItemIdentifiers
			: [],
		itemSessions: body.snapshot?.itemSessions || {},
	});
	return json({ ok: true, snapshot: getSectionSnapshot(key) });
};

export const DELETE: RequestHandler = async ({ url }) => {
	const key = parseSessionDemoKeyFromSearch(url.searchParams);
	if (!isValidSessionDemoKey(key)) {
		return json(
			{ ok: false, error: "assessmentId, sectionId, and attemptId are required" },
			{ status: 400 },
		);
	}
	deleteSectionSnapshot(key);
	return json({ ok: true });
};
