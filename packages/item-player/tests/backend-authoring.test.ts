import { describe, expect, test } from "bun:test";
import {
	getAuthoringBackend,
	getAuthoringBackendAuth,
	getAuthoringBackendLoadSignature,
	loadFromAuthoringBackend,
	releaseContentFromAuthoringBackend,
	saveContentToAuthoringBackend,
} from "../src/backend/authoring";
import type { BackendConfig } from "../src/types";

const config = {
	markup: '<multiple-choice id="2"></multiple-choice>',
	elements: {
		"multiple-choice": "@pie-element/multiple-choice@latest",
	},
	models: [{ id: "2", element: "multiple-choice" }],
};

describe("authoring backend helpers", () => {
	test("detects enabled authoring backend and ignores disabled config", () => {
		expect(getAuthoringBackend(undefined)).toBeNull();
		expect(getAuthoringBackend({ authoring: { enabled: false } })).toBeNull();
		expect(
			getAuthoringBackend({
				authoring: { enabled: true, contentId: "content-1" },
			})?.contentId,
		).toBe("content-1");
	});

	test("prefers authoring auth over shared backend auth", () => {
		const shared = { token: "shared" };
		const scoped = { token: "authoring" };

		expect(getAuthoringBackendAuth({ auth: shared })).toBe(shared);
		expect(
			getAuthoringBackendAuth({
				auth: shared,
				authoring: { enabled: true, auth: scoped },
			}),
		).toBe(scoped);
		expect(
			getAuthoringBackendAuth({
				auth: shared,
				authoring: { enabled: false, auth: scoped },
			}),
		).toBe(shared);
	});

	test("builds a stable authoring load signature from identity and client shape", () => {
		const backend: BackendConfig = {
			authoring: {
				enabled: true,
				baseUrl: "/authoring",
				contentId: "content-1",
				collectionId: "collection-1",
				client: {
					async load() {
						return { config };
					},
				},
			},
		};

		expect(getAuthoringBackendLoadSignature(backend)).toBe(
			JSON.stringify({
				provider: "custom",
				baseUrl: "/authoring",
				contentId: "content-1",
				collectionId: "collection-1",
				hasClientLoad: true,
				endpoint: null,
			}),
		);
	});

	test("loads content through a custom authoring client", async () => {
		const seenContexts: unknown[] = [];
		const backend: BackendConfig = {
			authoring: {
				enabled: true,
				contentId: "content-1",
				collectionId: "collection-1",
				client: {
					async load(context) {
						seenContexts.push(context);
						return {
							contentId: "content-2",
							config,
							metadata: { source: "authoring-test" },
						};
					},
				},
			},
		};

		const result = await loadFromAuthoringBackend(backend, {
			mode: "author",
			role: "instructor",
		});

		expect(seenContexts).toEqual([
			{
				contentId: "content-1",
				collectionId: "collection-1",
				env: { mode: "author", role: "instructor" },
			},
		]);
		expect(result).toEqual({
			contentId: "content-2",
			config,
			metadata: { source: "authoring-test" },
		});
	});

	test("saves and releases content through a custom authoring client", async () => {
		const seenContexts: unknown[] = [];
		const backend: BackendConfig = {
			authoring: {
				enabled: true,
				contentId: "content-1",
				collectionId: "collection-1",
				client: {
					async saveContent(context) {
						seenContexts.push({ type: "save", context });
						return { contentId: "content-2" };
					},
					async releaseContent(context) {
						seenContexts.push({ type: "release", context });
						return { contentId: "content-3" };
					},
				},
			},
		};
		const env = { mode: "author", role: "instructor" };

		const saveResult = await saveContentToAuthoringBackend(backend, {
			config,
			env,
			options: { preReleaseType: "prerelease" },
		});
		const releaseResult = await releaseContentFromAuthoringBackend(backend, {
			env,
			options: { releaseType: "final" },
		});

		expect(saveResult).toEqual({ contentId: "content-2" });
		expect(releaseResult).toEqual({ contentId: "content-3" });
		expect(seenContexts).toEqual([
			{
				type: "save",
				context: {
					contentId: "content-1",
					collectionId: "collection-1",
					config,
					env,
					options: { preReleaseType: "prerelease" },
				},
			},
			{
				type: "release",
				context: {
					contentId: "content-1",
					collectionId: "collection-1",
					env,
					options: { releaseType: "final" },
				},
			},
		]);
	});

	test("allows per-call identity overrides without mutating backend config", async () => {
		const seenContexts: unknown[] = [];
		const backend: BackendConfig = {
			authoring: {
				enabled: true,
				contentId: "content-1",
				collectionId: "collection-1",
				client: {
					async saveContent(context) {
						seenContexts.push({ type: "save", context });
						return { contentId: "content-2" };
					},
					async releaseContent(context) {
						seenContexts.push({ type: "release", context });
						return { contentId: "content-3" };
					},
				},
			},
		};
		const env = { mode: "author", role: "instructor" };

		await saveContentToAuthoringBackend(backend, {
			contentId: "content-override",
			collectionId: "collection-override",
			config,
			env,
		});
		await releaseContentFromAuthoringBackend(backend, {
			contentId: "release-content",
			collectionId: "release-collection",
			env,
		});

		expect(backend.authoring?.contentId).toBe("content-1");
		expect(backend.authoring?.collectionId).toBe("collection-1");
		expect(seenContexts).toEqual([
			{
				type: "save",
				context: {
					contentId: "content-override",
					collectionId: "collection-override",
					config,
					env,
					options: undefined,
				},
			},
			{
				type: "release",
				context: {
					contentId: "release-content",
					collectionId: "release-collection",
					env,
					options: undefined,
				},
			},
		]);
	});

	test("rejects clearly when authoring is disabled or client method is missing", async () => {
		await expect(
			loadFromAuthoringBackend({}, { mode: "author" }),
		).rejects.toThrow("Authoring backend is not configured.");
		await expect(
			loadFromAuthoringBackend(
				{ authoring: { enabled: true, client: {} } },
				{ mode: "author" },
			),
		).rejects.toThrow("backend.authoring.client.load is not configured.");
		await expect(
			saveContentToAuthoringBackend(
				{ authoring: { enabled: true, client: {} } },
				{ config, env: { mode: "author" } },
			),
		).rejects.toThrow("backend.authoring.client.saveContent is not configured.");
		await expect(
			releaseContentFromAuthoringBackend(
				{ authoring: { enabled: true, client: {} } },
				{ env: { mode: "author" } },
			),
		).rejects.toThrow(
			"backend.authoring.client.releaseContent is not configured.",
		);
	});

	test("uses built-in JSON authoring endpoints with scoped auth", async () => {
		const originalFetch = globalThis.fetch;
		const requests: Array<{
			url: string;
			method?: string;
			headers: Headers;
			body: Record<string, unknown>;
		}> = [];
		globalThis.fetch = (async (url, init) => {
			const urlString = String(url);
			requests.push({
				url: urlString,
				method: init?.method,
				headers: new Headers(init?.headers),
				body: JSON.parse(String(init?.body ?? "{}")),
			});
			const payload = urlString.endsWith("/load")
				? {
						contentId: "content-from-server",
						config,
						metadata: { source: "authoring-json" },
					}
				: { contentId: "content-from-server" };
			return new Response(
				JSON.stringify(payload),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		}) as typeof fetch;
		const backend: BackendConfig = {
			auth: { token: "shared-token" },
			authoring: {
				enabled: true,
				baseUrl: "https://bff.example",
				contentId: "content-1",
				collectionId: "collection-1",
				auth: { token: "authoring-token" },
			},
		};
		const env = { mode: "author", role: "instructor" };

		try {
			const loadResult = await loadFromAuthoringBackend(backend, env);
			const saveResult = await saveContentToAuthoringBackend(backend, {
				config,
				env,
				options: { preReleaseType: "prerelease" },
			});
			const releaseResult = await releaseContentFromAuthoringBackend(backend, {
				env,
				options: { releaseType: "final" },
			});

			expect(loadResult).toEqual({
				contentId: "content-from-server",
				config,
				metadata: { source: "authoring-json" },
			});
			expect(saveResult).toEqual({ contentId: "content-from-server" });
			expect(releaseResult).toEqual({ contentId: "content-from-server" });
		} finally {
			globalThis.fetch = originalFetch;
		}

		expect(requests.map(({ url }) => url)).toEqual([
			"https://bff.example/api/authoring/load",
			"https://bff.example/api/authoring/save",
			"https://bff.example/api/authoring/release",
		]);
		expect(requests.map(({ method }) => method)).toEqual([
			"POST",
			"POST",
			"POST",
		]);
		expect(
			requests.map(({ headers }) => headers.get("authorization")),
		).toEqual(["Bearer authoring-token", "Bearer authoring-token", "Bearer authoring-token"]);
		expect(requests.map(({ body }) => body)).toEqual([
			{
				contentId: "content-1",
				collectionId: "collection-1",
				env,
			},
			{
				contentId: "content-1",
				collectionId: "collection-1",
				config,
				env,
				options: { preReleaseType: "prerelease" },
			},
			{
				contentId: "content-1",
				collectionId: "collection-1",
				env,
				options: { releaseType: "final" },
			},
		]);
	});

	test("uses shared auth and endpoint overrides for built-in authoring calls", async () => {
		const originalFetch = globalThis.fetch;
		const requests: Array<{ url: string; method?: string; headers: Headers }> =
			[];
		globalThis.fetch = (async (url, init) => {
			requests.push({
				url: String(url),
				method: init?.method,
				headers: new Headers(init?.headers),
			});
			return new Response(JSON.stringify({ contentId: "content-2", config }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as typeof fetch;
		const backend: BackendConfig = {
			auth: {
				async getToken() {
					return "shared-token";
				},
			},
			authoring: {
				enabled: true,
				baseUrl: "https://bff.example/root/",
				contentId: "content-1",
				endpoints: {
					load: "/custom/load",
					saveContent: { method: "PUT", path: "custom/save" },
					releaseContent: "https://release.example/custom/release",
				},
				request: { headers: { "x-request-id": "authoring-test" } },
			},
		};
		const env = { mode: "author" };

		try {
			await loadFromAuthoringBackend(backend, env);
			await saveContentToAuthoringBackend(backend, { config, env });
			await releaseContentFromAuthoringBackend(backend, { env });
		} finally {
			globalThis.fetch = originalFetch;
		}

		expect(requests.map(({ url }) => url)).toEqual([
			"https://bff.example/root/custom/load",
			"https://bff.example/root/custom/save",
			"https://release.example/custom/release",
		]);
		expect(requests.map(({ method }) => method)).toEqual([
			"POST",
			"PUT",
			"POST",
		]);
		expect(
			requests.map(({ headers }) => headers.get("authorization")),
		).toEqual(["Bearer shared-token", "Bearer shared-token", "Bearer shared-token"]);
		expect(requests.map(({ headers }) => headers.get("x-request-id"))).toEqual([
			"authoring-test",
			"authoring-test",
			"authoring-test",
		]);
	});
});
