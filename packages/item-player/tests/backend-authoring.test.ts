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
});
