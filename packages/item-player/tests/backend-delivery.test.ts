import { describe, expect, test } from "bun:test";
import {
	getDeliveryAutosaveOptions,
	getDeliveryBackendLoadSignature,
	getDeliveryBackendModelSignature,
	loadFromDeliveryBackend,
	modelFromDeliveryBackend,
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

	test("passes delivery request options to every custom delivery handler", async () => {
		const seenRequestOptions: unknown[] = [];
		let seenScoreOptions: unknown;
		const backend: BackendConfig = {
			delivery: {
				enabled: true,
				itemId: "item-1",
				sessionId: "session-1",
				options: {
					overrides: {
						"student-grade": "5",
					},
				},
				client: {
					async load(context) {
						seenRequestOptions.push(context.requestOptions);
						return {
							item: config,
							session: { id: "session-1", data: [] },
						};
					},
					async model(context) {
						seenRequestOptions.push(context.requestOptions);
						return { models: [] };
					},
					async saveSession(context) {
						seenRequestOptions.push(context.requestOptions);
						return { ok: true };
					},
					async score(context) {
						seenRequestOptions.push(context.requestOptions);
						seenScoreOptions = context.options;
						return { points: 1, max: 1 };
					},
				},
			},
		};
		const sessionContext = {
			itemId: "item-1",
			sessionId: "session-1",
			session: { id: "session-1", data: [] },
			env: { mode: "gather", role: "student" },
		};

		await loadFromDeliveryBackend(backend, sessionContext.env);
		await modelFromDeliveryBackend(backend, sessionContext);
		await saveToDeliveryBackend(backend, sessionContext);
		await scoreWithDeliveryBackend(backend, sessionContext, {
			disablePartialScoring: true,
		});

		expect(seenRequestOptions).toEqual([
			{ overrides: { "student-grade": "5" } },
			{ overrides: { "student-grade": "5" } },
			{ overrides: { "student-grade": "5" } },
			{ overrides: { "student-grade": "5" } },
		]);
		expect(seenScoreOptions).toEqual({ disablePartialScoring: true });
	});

	test("sends delivery request overrides to every built-in delivery endpoint", async () => {
		const originalFetch = globalThis.fetch;
		const payloads: Array<{ url: string; body: Record<string, unknown> }> = [];
		globalThis.fetch = (async (url, init) => {
			payloads.push({
				url: String(url),
				body: JSON.parse(String(init?.body ?? "{}")),
			});
			return new Response(
				JSON.stringify({
					item: config,
					session: { id: "session-1", data: [] },
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		}) as typeof fetch;
		const backend: BackendConfig = {
			delivery: {
				enabled: true,
				itemId: "item-1",
				sessionId: "session-1",
				baseUrl: "https://bff.example",
				options: {
					overrides: {
						"student-grade": "5",
					},
				},
			},
		};
		const sessionContext = {
			itemId: "item-1",
			sessionId: "session-1",
			session: { id: "session-1", data: [] },
			env: { mode: "gather", role: "student" },
		};

		try {
			await loadFromDeliveryBackend(backend, sessionContext.env);
			await modelFromDeliveryBackend(backend, sessionContext);
			await saveToDeliveryBackend(backend, sessionContext);
			await scoreWithDeliveryBackend(backend, sessionContext, {
				disablePartialScoring: true,
				overrides: { ignored: "score-options-cannot-replace-delivery-overrides" },
			});
		} finally {
			globalThis.fetch = originalFetch;
		}

		expect(payloads.map(({ url }) => url)).toEqual([
			"https://bff.example/api/player/load",
			"https://bff.example/api/player/model",
			"https://bff.example/api/player/save",
			"https://bff.example/api/player/score",
		]);
		expect(payloads.map(({ body }) => body.overrides)).toEqual([
			{ "student-grade": "5" },
			{ "student-grade": "5" },
			{ "student-grade": "5" },
			{ "student-grade": "5" },
		]);
		expect(payloads[3]?.body.disablePartialScoring).toBe(true);
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
				options: {
					overrides: {
						"student-grade": "5",
					},
				},
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

	test("enables model refresh signatures only for configured model backends", () => {
		const env = { mode: "gather", role: "student" };
		expect(
			getDeliveryBackendModelSignature(
				{
					delivery: {
						enabled: true,
						itemId: "item-1",
						baseUrl: "/api",
					},
				},
				env,
			),
		).not.toBe("");
		expect(
			getDeliveryBackendModelSignature(
				{
					delivery: {
						enabled: true,
						itemId: "item-1",
						client: {
							async model() {
								return [];
							},
						},
					},
				},
				env,
			),
		).not.toBe("");
		expect(
			getDeliveryBackendModelSignature(
				{
					delivery: {
						enabled: true,
						itemId: "item-1",
						client: {
							async load() {
								return {
									item: config,
									session: { id: "session-1", data: [] },
								};
							},
						},
					},
				},
				env,
			),
		).toBe("");
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
