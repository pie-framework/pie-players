import { describe, expect, test } from "bun:test";
import {
	PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
	PIE_ITEM_SESSION_CHANGED_EVENT,
} from "@pie-players/pie-assessment-toolkit";
import { normalizeItemSessionChange } from "@pie-players/pie-players-shared";

function routeItemShellSession(detail: unknown) {
	const itemId = "item-1";
	const internalEvents = [
		{
			type: PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
			detail: { itemId, session: detail },
		},
	];
	const normalized = normalizeItemSessionChange({
		itemId,
		sessionDetail: detail,
		previousItemSession: {
			id: itemId,
			data: [{ id: "choice", value: ["A"] }],
		},
	});
	const publicEvents =
		normalized.intent === "metadata-only" || !normalized.session
			? []
			: [
					{
						type: PIE_ITEM_SESSION_CHANGED_EVENT,
						detail: {
							itemId,
							canonicalItemId: itemId,
							session: normalized.session,
						},
					},
				];

	return { internalEvents, normalized, publicEvents };
}

describe("ItemShellElement session routing contract", () => {
	test("keeps identity-only element echoes internal and metadata-only", () => {
		const routed = routeItemShellSession({
			session: {
				id: "choice",
				element: "multiple-choice--version-1-0-0",
				complete: true,
				component: "choice",
			},
		});

		expect(routed.internalEvents).toHaveLength(1);
		expect(routed.internalEvents[0]?.type).toBe(
			PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
		);
		expect(routed.normalized).toEqual(
			expect.objectContaining({
				intent: "metadata-only",
				session: null,
				complete: true,
				component: "choice",
			}),
		);
		expect(routed.publicEvents).toEqual([]);
	});

	test("keeps explicit clears on the public response-focused stream", () => {
		const routed = routeItemShellSession({
			session: {
				id: "choice",
				element: "multiple-choice--version-1-0-0",
				value: [],
			},
		});

		expect(routed.normalized.intent).toBe("merge-element-session");
		expect(routed.publicEvents).toEqual([
			{
				type: PIE_ITEM_SESSION_CHANGED_EVENT,
				detail: {
					itemId: "item-1",
					canonicalItemId: "item-1",
					session: {
						id: "item-1",
						data: [
							{
								id: "choice",
								value: [],
								element: "multiple-choice--version-1-0-0",
							},
						],
					},
				},
			},
		]);
	});
});
