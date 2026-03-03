import { afterEach, describe, expect, it } from "bun:test";
import { handleRequest } from "../src/core/handler.ts";
import {
	createFixtureContext,
	createTempFixture,
	makeRequest,
	writePackageFile,
} from "./fixtures.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
	while (cleanups.length) {
		const cleanup = cleanups.pop();
		if (cleanup) {
			await cleanup();
		}
	}
});

describe("local-esm-cdn errors and safety behavior", () => {
	it("returns not found text with help for unknown non-package paths", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);
		const context = createFixtureContext(fixture);

		const response = await handleRequest(makeRequest("/not-a-package-route"), context);
		expect(response.status).toBe(404);
		expect(response.headers.get("content-type")).toContain("text/plain");
		const body = await response.text();
		expect(body).toContain("Not found.");
		expect(body).toContain("PIE local ESM CDN");
	});

	it("does not serve path traversal-like subpaths", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);
		await writePackageFile({
			pieElementsNgRoot: fixture.pieElementsNgRoot,
			scope: "@pie-element",
			name: "hotspot",
			relativePath: "index.js",
			content: "export const ok = true;",
		});

		const context = createFixtureContext(fixture);
		const response = await handleRequest(
			makeRequest("/@pie-element/hotspot@1.0.0/../../outside.js"),
			context,
		);

		expect(response.status).toBe(404);
	});
});
