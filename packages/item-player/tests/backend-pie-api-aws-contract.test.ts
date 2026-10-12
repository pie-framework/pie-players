/**
 * The built-in delivery transport against pie-api-aws's player routes. The
 * responses are the shapes pie-api-aws answers with, taken from its route
 * integration specs (`functions/player/tests/*.int.spec.ts`, develop at
 * 57380b17): a flat model array under authored tags, a `SessionScore`, an
 * empty 201 from save, and error bodies carrying `error` or only `message`.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { makeUniqueTags } from "@pie-players/pie-players-shared";
import {
	loadFromDeliveryBackend,
	modelFromDeliveryBackend,
	saveToDeliveryBackend,
	scoreWithDeliveryBackend,
} from "../src/backend/delivery";
import { applyDeliveryModelResultToConfigs } from "../src/backend/model-refresh";
import type { BackendConfig } from "../src/types";

type Captured = {
	url: string;
	headers: Record<string, string>;
	body: Record<string, unknown>;
};

const originalFetch = globalThis.fetch;
let requests: Captured[] = [];

function respondWith(status: number, body?: unknown) {
	requests = [];
	globalThis.fetch = (async (url, init) => {
		requests.push({
			url: String(url),
			headers: { ...(init?.headers as Record<string, string>) },
			body: JSON.parse(String(init?.body ?? "{}")),
		});
		return new Response(body === undefined ? null : JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});
	}) as typeof fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

const itemConfig = {
	id: "1",
	markup:
		'<pp-pie-element-multiple-choice id="p-00000000"></pp-pie-element-multiple-choice>',
	elements: {
		"pp-pie-element-multiple-choice": "@pie-element/multiple-choice@11.4.0",
	},
	models: [
		{
			id: "p-00000000",
			element: "pp-pie-element-multiple-choice",
			prompt: "Before",
		},
	],
};

const passageConfig = {
	id: "2",
	markup: '<passage id="2"></passage>',
	elements: { passage: "@pie-element/passage@1.0.0" },
	models: [{ id: "2", element: "passage", text: "Before" }],
};

function backend(options?: BackendConfig["delivery"]): BackendConfig {
	return {
		auth: { token: "host-minted-jwt" },
		delivery: {
			enabled: true,
			baseUrl: "https://pie-api.example",
			itemId: "item-base@1.0.0",
			sessionId: "session-1",
			assignmentId: "assignment-1",
			...options,
		},
	};
}

const sessionContext = {
	itemId: "item-base@1.0.0",
	sessionId: "session-1",
	assignmentId: "assignment-1",
	session: { id: "session-1", data: [{ id: "p-00000000", value: ["0"] }] },
	env: { mode: "gather", role: "student" },
};

describe("pie-api-aws delivery contract", () => {
	test("every request carries the bearer token and a client timestamp", async () => {
		respondWith(200, { session: { id: "session-1", data: [] }, item: itemConfig });
		await loadFromDeliveryBackend(backend(), sessionContext.env);

		expect(requests[0]?.url).toBe("https://pie-api.example/api/player/load");
		expect(requests[0]?.headers.authorization).toBe("Bearer host-minted-jwt");
		expect(Number(requests[0]?.headers["x-date"])).toBeGreaterThan(0);
	});

	test("load accepts the item config and the `{ pie, passage }` shape", async () => {
		respondWith(200, {
			session: { id: "session-1", data: [] },
			js: { view: [] },
			item: { pie: itemConfig, passage: passageConfig },
		});
		const result = await loadFromDeliveryBackend(backend(), sessionContext.env);

		expect(result.config).toEqual({ pie: itemConfig, passage: passageConfig });
		expect(result.session).toEqual({ id: "session-1", data: [] });
	});

	test("a session model request names the session, not the item", async () => {
		respondWith(200, []);
		await modelFromDeliveryBackend(backend(), sessionContext);

		const body = requests[0]?.body ?? {};
		expect(body.sessionId).toBe("session-1");
		expect(body.data).toEqual(sessionContext.session.data);
		// With an itemId pie-api-aws ignores `data` and records no events.
		expect("itemId" in body).toBe(false);
		expect("assignmentId" in body).toBe(false);
	});

	test("a model request without a session names the item", async () => {
		respondWith(200, []);
		await modelFromDeliveryBackend(backend({ sessionId: undefined }), {
			...sessionContext,
			sessionId: undefined,
			session: { id: "", data: [] },
		});

		expect(requests[0]?.body.itemId).toBe("item-base@1.0.0");
	});

	test("the flat model array refreshes item and passage models under runtime tags", () => {
		const runtimeItem = makeUniqueTags({ config: itemConfig }).config;
		const runtimePassage = makeUniqueTags({ config: passageConfig }).config;
		const refreshed = applyDeliveryModelResultToConfigs({
			itemConfig: runtimeItem,
			passageConfig: runtimePassage,
			result: [
				{ id: "p-00000000", element: "pp-pie-element-multiple-choice", prompt: "After" },
				{ id: "2", element: "passage", text: "After" },
			],
		});

		expect(refreshed.itemConfig?.models[0]).toEqual({
			id: "p-00000000",
			element: runtimeItem.models[0]?.element,
			prompt: "After",
		});
		expect(refreshed.passageConfig?.models[0]).toEqual({
			id: "2",
			element: runtimePassage.models[0]?.element,
			text: "After",
		});
	});

	test("save resolves on pie-api-aws's empty 201", async () => {
		respondWith(201);
		await expect(
			saveToDeliveryBackend(backend(), sessionContext),
		).resolves.toBeNull();
		expect(requests[0]?.url).toBe("https://pie-api.example/api/player/save");
	});

	test("score returns the SessionScore as pie-api-aws sends it", async () => {
		const score = { max: 1, points: 1, partialScoring: false, type: "auto" };
		respondWith(200, score);

		await expect(
			scoreWithDeliveryBackend(backend(), sessionContext),
		).resolves.toEqual(score);
		expect(requests[0]?.body.sessionId).toBe("session-1");
	});

	test("empty overrides are not sent, so no overrides scope is needed", async () => {
		respondWith(200, []);
		await modelFromDeliveryBackend(
			backend({ options: { overrides: {} } }),
			sessionContext,
		);

		expect("overrides" in (requests[0]?.body ?? {})).toBe(false);
	});

	test("errors surface pie-api-aws's detail, or the gateway's message", async () => {
		respondWith(404, {
			statusCode: 404,
			message: "Failed to load player.",
			error: "Assignment not found",
		});
		await expect(
			loadFromDeliveryBackend(backend(), sessionContext.env),
		).rejects.toThrow("Assignment not found");

		respondWith(401, { message: "Unauthorized" });
		await expect(
			loadFromDeliveryBackend(backend(), sessionContext.env),
		).rejects.toThrow("Unauthorized");
	});
});
