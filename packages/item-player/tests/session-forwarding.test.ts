import { describe, expect, test } from "bun:test";
import {
	asCommittedDetail,
	resolveSessionChangedForwarding,
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

// The only way to build a replay detail: the enrichment underneath is not
// exported, because enriching without marking is the defect this covers.
describe("asCommittedDetail", () => {
	// The element contract's own event: `complete` and `component`, response on
	// the element. Unenriched, `resolveSessionChangedForwarding` ignores it and
	// the committed response reaches nobody.
	const elementSession = {
		id: "committed-choice",
		element: "multiple-choice--version-1-0-0",
		value: ["B"],
	};
	const elementTarget = {
		session: elementSession,
	} as unknown as EventTarget;

	// The element-owned path, and the composition that regressed: the enrichment
	// returns a copy, so a marker the sweep's capture listener stamps on the
	// original detail never reaches the object being replayed. Each half is
	// covered on its own - here and in players-shared/tests/session-commit.test.ts
	// - and it was only together that the commit lost its marker.
	test("reads the session off the element that dispatched, and marks it", () => {
		const detail = { complete: true, component: "multiple-choice" };
		const committed = asCommittedDetail(detail, elementTarget, "teardown");

		expect(committed).toEqual({
			complete: true,
			component: "multiple-choice",
			session: elementSession,
			sessionCommitReason: "teardown",
		});
		expect(
			resolveSessionChangedForwarding({
				currentSession: { id: "committed-item", data: [] },
				currentSignature: JSON.stringify({ id: "committed-item", data: [] }),
				detail: committed,
				itemId: "committed-item",
			}),
		).toMatchObject({ action: "forward", changed: true });
	});

	test("copies the session rather than aliasing element state", () => {
		const committed = asCommittedDetail(
			{ complete: false },
			elementTarget,
			"teardown",
		) as { session: typeof elementSession };

		expect(committed.session).not.toBe(elementSession);
		expect(committed.session.value).not.toBe(elementSession.value);
	});

	test("carries the reason it was given", () => {
		expect(
			asCommittedDetail({ complete: true }, elementTarget, "navigate"),
		).toMatchObject({ sessionCommitReason: "navigate" });
		expect(
			asCommittedDetail({ complete: true }, elementTarget, "page-hidden"),
		).toMatchObject({ sessionCommitReason: "page-hidden" });
	});

	test("keeps a session the detail already carries, without consulting the element", () => {
		const ownSession = { id: "x", data: [] };
		const detail = { session: ownSession };
		const committed = asCommittedDetail(detail, elementTarget, "teardown") as {
			session: unknown;
			sessionCommitReason: string;
		};

		expect(committed.session).toBe(ownSession);
		expect(committed.sessionCommitReason).toBe("teardown");
	});

	// A synthesized commit builds the reason in itself, so the seam that replays
	// it must not relabel it.
	test("leaves a reason the detail already carries", () => {
		const detail = {
			session: { id: "x", data: [] },
			sessionCommitReason: "navigate",
		};

		expect(asCommittedDetail(detail, elementTarget, "teardown")).toBe(detail);
	});

	// The enrichment declines - no session on the element, or a getter that
	// throws - so there is no copy of ours to write on. Marking the element's own
	// detail instead would be a write to a foreign, possibly frozen, object.
	test("marks a detail it could not enrich, without mutating it", () => {
		const detail = { complete: true };

		for (const target of [{} as EventTarget, null]) {
			const committed = asCommittedDetail(detail, target, "teardown");

			expect(committed).not.toBe(detail);
			expect(committed).toEqual({
				complete: true,
				sessionCommitReason: "teardown",
			});
			expect(detail).toEqual({ complete: true });
		}
	});

	test("survives a session getter that throws", () => {
		const detail = { complete: true };
		const target = {
			get session() {
				throw new Error("no session here");
			},
		} as unknown as EventTarget;

		expect(asCommittedDetail(detail, target, "teardown")).toEqual({
			complete: true,
			sessionCommitReason: "teardown",
		});
	});

	test("leaves a non-record detail alone", () => {
		expect(asCommittedDetail(null, elementTarget, "teardown")).toBe(null);
		expect(
			asCommittedDetail("session-changed", elementTarget, "teardown"),
		).toBe("session-changed");
	});
});
