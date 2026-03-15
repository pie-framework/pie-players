import { getSectionDemoById } from "$lib/content/sections";
import { json } from "@sveltejs/kit";
import { _defaultSeedSections } from "../../bootstrap/+server";
import {
	getSectionSnapshot,
	seedSessionDemoData,
	upsertSectionSnapshot,
	type SessionDemoSnapshot,
	type SessionDemoKey,
} from "../../db";
import type { RequestHandler } from "./$types";

function cloneSnapshot(snapshot: SessionDemoSnapshot | null): SessionDemoSnapshot {
	if (!snapshot) {
		return {
			currentItemIndex: 0,
			visitedItemIdentifiers: [],
			itemSessions: {},
		};
	}
	return {
		currentItemIndex: snapshot.currentItemIndex ?? 0,
		visitedItemIdentifiers: Array.isArray(snapshot.visitedItemIdentifiers)
			? [...snapshot.visitedItemIdentifiers]
			: [],
		itemSessions: { ...(snapshot.itemSessions || {}) },
	};
}

function seedIfNeeded(assessmentId: string, attemptId: string, reset: boolean): void {
	if (!reset) {
		const hasAllSections = _defaultSeedSections.every((entry) =>
			Boolean(
				getSectionSnapshot({
					assessmentId,
					attemptId,
					sectionId: entry.sectionId,
				}),
			),
		);
		if (hasAllSections) return;
	}
	seedSessionDemoData({
		assessmentId,
		attemptId,
		sections: _defaultSeedSections.map((entry) => ({
			sectionId: entry.sectionId,
			snapshot: {
				currentItemIndex: entry.snapshot.currentItemIndex,
				visitedItemIdentifiers: entry.snapshot.visitedItemIdentifiers,
				itemSessions: entry.snapshot.itemSessions,
			},
		})),
	});
}

function buildActivityLoadPayload(args: {
	assessmentId: string;
	attemptId: string;
	sectionId: string;
	mutateMissingSessionIds: boolean;
}):
	| {
			ok: true;
			activitySessionId: string;
			activityDefinition: {
				sections: Array<Record<string, unknown>>;
				stats: { totalItems: number; totalSections: number };
			};
			itemToSession: Record<string, { id: string; data: unknown[] }>;
			itemToJs: Record<string, { view: string[] }>;
			section: Record<string, unknown> | null;
			sessionState: SessionDemoSnapshot | null;
	  }
	| { ok: false; error: string } {
	const demo = getSectionDemoById("session-hydrate-db");
	const sections = ((demo?.sections || []).map((entry) => entry.section) || []) as unknown as Array<
		Record<string, unknown>
	>;
	const requestedSection =
		sections.find((section) => section.identifier === args.sectionId) || null;
	if (!requestedSection) {
		return {
			ok: false,
			error: `Unknown sectionId for session-hydrate-db: ${args.sectionId}`,
		};
	}

	const itemToSession: Record<string, { id: string; data: unknown[] }> = {};

	for (const section of sections) {
		const key: SessionDemoKey = {
			assessmentId: args.assessmentId,
			attemptId: args.attemptId,
			sectionId: String(section.identifier || ""),
		};
		const original = getSectionSnapshot(key);
		const next = cloneSnapshot(original);
		let changed = false;
		for (const ref of (section.assessmentItemRefs as Array<Record<string, unknown>>) || []) {
			const itemId = String(ref.identifier || (ref.item as Record<string, unknown>)?.id || "");
			if (!itemId) continue;
			const rawEntry = next.itemSessions[itemId];
			if (!rawEntry || typeof rawEntry !== "object") continue;
			const entry = rawEntry as Record<string, unknown>;
			const rawSession =
				entry.session && typeof entry.session === "object"
					? (entry.session as Record<string, unknown>)
					: entry;
			const currentId =
				typeof rawSession.id === "string" && rawSession.id.trim()
					? rawSession.id.trim()
					: "";
			const sessionId = currentId || `sess-${args.attemptId}-${itemId}`;
			const data = Array.isArray(rawSession.data) ? rawSession.data : [];
			itemToSession[itemId] = { id: sessionId, data };
			if (!args.mutateMissingSessionIds || currentId) continue;
			next.itemSessions[itemId] = {
				...entry,
				session: {
					...rawSession,
					id: sessionId,
					data,
				},
			};
			changed = true;
		}
		if (changed) {
			upsertSectionSnapshot(key, next);
		}
	}

	const sessionState = getSectionSnapshot({
		assessmentId: args.assessmentId,
		attemptId: args.attemptId,
		sectionId: args.sectionId,
	});
	const totalItems = sections.reduce(
		(count, section) =>
			count +
			((((section.assessmentItemRefs as Array<Record<string, unknown>> | undefined) || [])
				.length as number) || 0),
		0,
	);

	return {
		ok: true,
		activitySessionId: `activity-session-${args.attemptId}`,
		activityDefinition: {
			sections,
			stats: {
				totalItems,
				totalSections: sections.length,
			},
		},
		itemToSession,
		itemToJs: {},
		section: requestedSection,
		sessionState,
	};
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		assessmentId?: string;
		attemptId?: string;
		sectionId?: string;
		reset?: boolean;
	};
	const assessmentId = body.assessmentId || "";
	const attemptId = body.attemptId || "";
	const sectionId = body.sectionId || "";
	if (!assessmentId || !attemptId || !sectionId) {
		return json(
			{ ok: false, error: "assessmentId, attemptId, and sectionId are required" },
			{ status: 400 },
		);
	}

	seedIfNeeded(assessmentId, attemptId, body.reset === true);
	const response = buildActivityLoadPayload({
		assessmentId,
		attemptId,
		sectionId,
		mutateMissingSessionIds: true,
	});
	if (!response.ok) {
		return json(response, { status: 400 });
	}
	return json(response);
};

export const GET: RequestHandler = async ({ url }) => {
	const assessmentId = url.searchParams.get("assessmentId") || "";
	const attemptId = url.searchParams.get("attemptId") || "";
	const sectionId = url.searchParams.get("sectionId") || "";
	if (!assessmentId || !attemptId || !sectionId) {
		return json(
			{ ok: false, error: "assessmentId, attemptId, and sectionId are required" },
			{ status: 400 },
		);
	}
	const response = buildActivityLoadPayload({
		assessmentId,
		attemptId,
		sectionId,
		mutateMissingSessionIds: false,
	});
	if (!response.ok) {
		return json(response, { status: 400 });
	}
	return json(response);
};
