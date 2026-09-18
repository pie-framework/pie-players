import { describe, expect, test } from "bun:test";
import {
	resolveSessionChangedForwarding,
	withCommittedSession,
} from "../src/session-forwarding";

const responsefulSession = {
	id: "metadata-session-item",
	data: [
		{
			id: "metadata-choice",
			element: "metadata-session-fixture--version-1-0-0",
			value: ["A"],
		},
	],
};

describe("resolveSessionChangedForwarding", () => {
	test("ignores unchanged non-metadata session details", () => {
		const result = resolveSessionChangedForwarding({
			currentSession: responsefulSession,
			currentSignature: JSON.stringify(responsefulSession),
			detail: {
				session: responsefulSession,
			},
			itemId: "metadata-session-item",
		});

		expect(result).toEqual({ action: "ignore" });
	});

	test("forwards post-renderer metadata snapshots as metadata-only details", () => {
		const detail = {
			session: {
				id: "",
				data: responsefulSession.data,
			},
			complete: true,
			component: "metadata-session-fixture--version-1-0-0",
		};
		const result = resolveSessionChangedForwarding({
			currentSession: responsefulSession,
			currentSignature: JSON.stringify(responsefulSession),
			detail,
			itemId: "metadata-session-item",
		});

		expect(result).toMatchObject({
			action: "forward",
			changed: false,
			metadataOnly: true,
			session: responsefulSession,
			signature: JSON.stringify(responsefulSession),
		});
		expect(result.action === "forward" ? result.detail : null).toEqual({
			...detail,
			intent: "metadata-only",
			session: null,
		});
	});

	test("keeps explicit empty-array clears as data changes", () => {
		const result = resolveSessionChangedForwarding({
			currentSession: responsefulSession,
			currentSignature: JSON.stringify(responsefulSession),
			detail: {
				session: {
					id: "metadata-choice",
					element: "metadata-session-fixture--version-1-0-0",
					value: [],
				},
			},
			itemId: "metadata-session-item",
		});

		expect(result).toMatchObject({
			action: "forward",
			changed: true,
			metadataOnly: false,
			session: {
				id: "metadata-session-item",
				data: [
					{
						id: "metadata-choice",
						element: "metadata-session-fixture--version-1-0-0",
						value: [],
					},
				],
			},
		});
	});

	test("keeps explicit empty-string clears as data changes", () => {
		const currentSession = {
			id: "metadata-session-item",
			data: [
				{
					id: "metadata-text",
					element: "text-entry--version-1-0-0",
					value: "typed answer",
				},
			],
		};
		const result = resolveSessionChangedForwarding({
			currentSession,
			currentSignature: JSON.stringify(currentSession),
			detail: {
				session: {
					id: "metadata-text",
					element: "text-entry--version-1-0-0",
					value: "",
				},
			},
			itemId: "metadata-session-item",
		});

		expect(result).toMatchObject({
			action: "forward",
			changed: true,
			metadataOnly: false,
			session: {
				id: "metadata-session-item",
				data: [
					{
						id: "metadata-text",
						element: "text-entry--version-1-0-0",
						value: "",
					},
				],
			},
		});
	});
});

describe("withCommittedSession", () => {
	// The element contract's own event: `complete` and `component`, response on
	// the element. Unenriched, `resolveSessionChangedForwarding` ignores it and
	// the committed response reaches nobody.
	const elementSession = {
		id: "committed-choice",
		element: "multiple-choice--version-1-0-0",
		value: ["B"],
	};

	test("reads the session off the element that dispatched", () => {
		const detail = { complete: true, component: "multiple-choice" };
		const enriched = withCommittedSession(detail, {
			session: elementSession,
		} as unknown as EventTarget);

		expect(enriched).toEqual({
			complete: true,
			component: "multiple-choice",
			session: elementSession,
		});
		expect(
			resolveSessionChangedForwarding({
				currentSession: { id: "committed-item", data: [] },
				currentSignature: JSON.stringify({ id: "committed-item", data: [] }),
				detail: enriched,
				itemId: "committed-item",
			}),
		).toMatchObject({ action: "forward", changed: true });
	});

	test("copies the session rather than aliasing element state", () => {
		const enriched = withCommittedSession(
			{ complete: false },
			{ session: elementSession } as unknown as EventTarget,
		) as { session: typeof elementSession };

		expect(enriched.session).not.toBe(elementSession);
		expect(enriched.session.value).not.toBe(elementSession.value);
	});

	test("leaves a detail that already carries a session alone", () => {
		const detail = { session: { id: "x", data: [] } };

		expect(
			withCommittedSession(detail, {
				session: elementSession,
			} as unknown as EventTarget),
		).toBe(detail);
	});

	test("leaves the detail alone when the element has no session", () => {
		const detail = { complete: true };

		expect(withCommittedSession(detail, {} as EventTarget)).toBe(detail);
		expect(withCommittedSession(detail, null)).toBe(detail);
	});

	test("survives a session getter that throws", () => {
		const detail = { complete: true };
		const target = {
			get session() {
				throw new Error("no session here");
			},
		} as unknown as EventTarget;

		expect(withCommittedSession(detail, target)).toBe(detail);
	});

	test("leaves a non-record detail alone", () => {
		expect(withCommittedSession(null, {} as EventTarget)).toBe(null);
		expect(withCommittedSession("session-changed", {} as EventTarget)).toBe(
			"session-changed",
		);
	});
});
