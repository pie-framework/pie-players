import { afterEach, describe, expect, it } from "bun:test";
import { handleRequest } from "../src/core/handler.ts";
import {
	parsePackageRequest,
	resolveEntryFile,
} from "../src/core/resolver.ts";
import {
	createFixtureContext,
	createTempFixture,
	makeRequest,
	readJson,
	writePackageFile,
	writePackageJson,
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

describe("local-esm-cdn package resolution and serving", () => {
	it("parses package requests with and without version suffix", () => {
		expect(parsePackageRequest("/@pie-element/hotspot@1.2.3")).toEqual({
			pkg: "@pie-element/hotspot",
			subpath: "",
		});
		expect(parsePackageRequest("/@pie-lib/render-ui/controller/index.js")).toEqual({
			pkg: "@pie-lib/render-ui",
			subpath: "controller/index.js",
		});
		expect(parsePackageRequest("/invalid/path")).toBeNull();
	});

	it("resolves package entrypoints from package.json exports", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);

		await writePackageFile({
			pieElementsNgRoot: fixture.pieElementsNgRoot,
			scope: "@pie-lib",
			name: "render-ui",
			relativePath: "main.js",
			content: "export const value = 1;",
		});
		await writePackageJson({
			pieElementsNgRoot: fixture.pieElementsNgRoot,
			scope: "@pie-lib",
			name: "render-ui",
			content: {
				name: "@pie-lib/render-ui",
				exports: {
					".": {
						default: "./dist/main.js",
					},
				},
			},
		});

		const resolved = await resolveEntryFile(
			fixture.pieElementsNgRoot,
			fixture.piePlayersRoot,
			"@pie-lib/render-ui",
			"",
		);
		expect(resolved).toContain("/packages/lib-react/render-ui/dist/main.js");
	});

	it("serves JS module with expected headers when package exists", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);
		const externalDep = ["rea", "ct"].join("");
		await writePackageFile({
			pieElementsNgRoot: fixture.pieElementsNgRoot,
			scope: "@pie-elements-ng",
			name: "shared-math-rendering",
			relativePath: "index.js",
			content: `import React from "${externalDep}"; export const x = React;`,
		});

		const context = createFixtureContext(fixture, {
			esmShBaseUrl: "https://esm.sh",
		});
		const response = await handleRequest(
			makeRequest("/@pie-elements-ng/shared-math-rendering@1.0.0"),
			context,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain(
			"application/javascript",
		);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("x-local-esm-cdn-file")).toContain(
			"/packages/shared/math-rendering/dist/index.js",
		);
		const body = await response.text();
		expect(body).toContain("https://esm.sh/react");
	});

	it("returns 404 json for missing package entry", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);
		await writePackageFile({
			pieElementsNgRoot: fixture.pieElementsNgRoot,
			scope: "@pie-element",
			name: "existing",
			relativePath: "index.js",
			content: "export const ok = true;",
		});

		const context = createFixtureContext(fixture);
		const response = await handleRequest(
			makeRequest("/@pie-element/not-there@1.0.0"),
			context,
		);

		expect(response.status).toBe(404);
		const body = await readJson<{ error: string; requested: { pkg: string } }>(
			response,
		);
		expect(body.error).toContain("Entrypoint not found");
		expect(body.requested.pkg).toBe("@pie-element/not-there");
	});
});
