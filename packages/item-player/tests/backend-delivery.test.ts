import { describe, expect, test } from "bun:test";
import {
	getDeliveryAutosaveOptions,
	getDeliveryBackendLoadSignature,
	loadFromDeliveryBackend,
	saveToDeliveryBackend,
	scoreWithDeliveryBackend,
} from "../src/backend/delivery";
import type { BackendConfig } from "../src/types";

const config = {
	markup: '<multiple-choice id="2"></multiple-choice>',
	elements: {
		"multiple-choice": "@pie-element/multiple-choice@latest",
	},
	models: [{ id: "2", element: "multiple-choice" }],
};

describe("delivery backend helpers", () => {
	test("loads config and session through a custom delivery client", async () => {
		const backend: BackendConfig = {
			delivery: {
				enabled: true,
				itemId: "item-1",
				sessionId: "session-1",
				client: {
					async load(context) {
						expect(context.itemId).toBe("item-1");
						expect(context.sessionId).toBe("session-1");
						return {
							item: config,
							session: { id: "session-1", data: [] },
							metadata: { source: "test" },
						};
					},
				},
			},
		};

		const result = await loadFromDeliveryBackend(backend, {
			mode: "gather",
			role: "student",
		});

		expect(result.config).toEqual(config);
		expect(result.session).toEqual({ id: "session-1", data: [] });
		expect(result.metadata).toEqual({ source: "test" });
	});

	test("normalizes autosave settings", () => {
		expect(getDeliveryAutosaveOptions(undefined)).toEqual({
			enabled: false,
			debounceMs: 100,
		});
		expect(getDeliveryAutosaveOptions(true)).toEqual({
			enabled: true,
			debounceMs: 100,
		});
		expect(getDeliveryAutosaveOptions({ debounceMs: 25 })).toEqual({
			enabled: true,
			debounceMs: 25,
		});
	});

	test("keeps loader and env inputs out of backend load signature", () => {
		const backend: BackendConfig = {
			delivery: {
				enabled: true,
				itemId: "item-1",
				sessionId: "session-1",
				baseUrl: "/api",
				autosave: true,
			},
		};

		expect(getDeliveryBackendLoadSignature(backend)).toBe(
			JSON.stringify({
				provider: "pie-api",
				baseUrl: "/api",
				itemId: "item-1",
				sessionId: "session-1",
				assignmentId: "",
				hasClientLoad: false,
				endpoint: null,
			}),
		);
	});

	test("saves and scores through custom delivery handlers", async () => {
		const calls: string[] = [];
		const backend: BackendConfig = {
			delivery: {
				enabled: true,
				itemId: "item-1",
				client: {
					async saveSession(context) {
						calls.push(`save:${context.session.id}`);
						return { ok: true };
					},
					async score(context) {
						calls.push(`score:${context.session.id}`);
						return { points: 1, max: 1 };
					},
				},
			},
		};
		const context = {
			itemId: "item-1",
			session: { id: "session-1", data: [] },
			env: { mode: "gather", role: "student" },
		};

		await saveToDeliveryBackend(backend, context);
		const score = await scoreWithDeliveryBackend(backend, context);

		expect(calls).toEqual(["save:session-1", "score:session-1"]);
		expect(score).toEqual({ points: 1, max: 1 });
	});
});
