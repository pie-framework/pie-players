import { describe, expect, test } from "bun:test";
import {
	createSessionEmitPolicyState,
	resetSessionEmitPolicyState,
	shouldEmitCanonicalSessionEvent,
} from "../src/runtime/session-event-emitter-policy.js";

describe("session-event-emitter-policy", () => {
	test("suppresses duplicate canonical payloads ignoring timestamp/sourceRuntimeId", () => {
		const state = createSessionEmitPolicyState();
		const itemId = "item-1";
		const first = shouldEmitCanonicalSessionEvent({
			state,
			itemId,
			payload: {
				itemId,
				intent: "replace-item-session",
				session: { id: itemId, data: [{ id: "mc", value: "A" }] },
				timestamp: 1000,
				sourceRuntimeId: "runtime-a",
			},
		});
		const second = shouldEmitCanonicalSessionEvent({
			state,
			itemId,
			payload: {
				itemId,
				intent: "replace-item-session",
				session: { id: itemId, data: [{ id: "mc", value: "A" }] },
				timestamp: 2000,
				sourceRuntimeId: "runtime-b",
			},
		});
		expect(first).toBe(true);
		expect(second).toBe(false);
	});

	test("emits metadata-only only when metadata changes", () => {
		const state = createSessionEmitPolicyState();
		const itemId = "item-2";
		expect(
			shouldEmitCanonicalSessionEvent({
				state,
				itemId,
				payload: {
					itemId,
					intent: "metadata-only",
					session: null,
					complete: false,
					component: "multiple-choice",
					timestamp: 1000,
				},
			}),
		).toBe(true);
		expect(
			shouldEmitCanonicalSessionEvent({
				state,
				itemId,
				payload: {
					itemId,
					intent: "metadata-only",
					session: null,
					complete: false,
					component: "multiple-choice",
					timestamp: 1001,
				},
			}),
		).toBe(false);
		expect(
			shouldEmitCanonicalSessionEvent({
				state,
				itemId,
				payload: {
					itemId,
					intent: "metadata-only",
					session: null,
					complete: true,
					component: "multiple-choice",
					timestamp: 1002,
				},
			}),
		).toBe(true);
	});

	test("metadata-only dedupe works without canonicalItemId in payload", () => {
		const state = createSessionEmitPolicyState();
		const itemId = "item-2b";
		expect(
			shouldEmitCanonicalSessionEvent({
				state,
				itemId,
				payload: {
					itemId,
					intent: "metadata-only",
					session: null,
					complete: false,
					component: "multiple-choice",
				},
			}),
		).toBe(true);
		expect(
			shouldEmitCanonicalSessionEvent({
				state,
				itemId,
				payload: {
					itemId,
					intent: "metadata-only",
					session: null,
					complete: false,
					component: "multiple-choice",
				},
			}),
		).toBe(false);
	});

	test("reset clears dedupe state", () => {
		const state = createSessionEmitPolicyState();
		const itemId = "item-3";
		expect(
			shouldEmitCanonicalSessionEvent({
				state,
				itemId,
				payload: {
					itemId,
					intent: "replace-item-session",
					session: { id: itemId, data: [] },
				},
			}),
		).toBe(true);
		expect(
			shouldEmitCanonicalSessionEvent({
				state,
				itemId,
				payload: {
					itemId,
					intent: "replace-item-session",
					session: { id: itemId, data: [] },
				},
			}),
		).toBe(false);
		resetSessionEmitPolicyState(state);
		expect(
			shouldEmitCanonicalSessionEvent({
				state,
				itemId,
				payload: {
					itemId,
					intent: "replace-item-session",
					session: { id: itemId, data: [] },
				},
			}),
		).toBe(true);
	});
});
