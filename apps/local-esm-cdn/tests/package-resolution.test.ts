import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { handleRequest } from "../src/core/handler.ts";
import { parsePackageRequest, resolveEntryFile } from "../src/core/resolver.ts";
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
		expect(
			parsePackageRequest("/@pie-lib/render-ui/controller/index.js"),
		).toEqual({
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
			"@pie-lib/render-ui",
			"",
		);
		expect(resolved?.file).toContain(
			"/packages/lib-react/render-ui/dist/main.js",
		);
	});

	it("resolves @pie-element packages from the Svelte element workspace", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);
		const packageRoot = path.join(
			fixture.pieElementsNgRoot,
			"packages",
			"elements-svelte",
			"simple-cloze",
		);
		await mkdir(path.join(packageRoot, "dist", "browser", "delivery"), {
			recursive: true,
		});
		await writeFile(
			path.join(packageRoot, "dist", "browser", "delivery", "index.js"),
			"export default class SimpleClozeElement extends HTMLElement {};",
			"utf8",
		);
		await writeFile(
			path.join(packageRoot, "package.json"),
			JSON.stringify({
				name: "@pie-element/simple-cloze",
				exports: {
					"./browser/delivery": {
						default: "./dist/browser/delivery/index.js",
					},
				},
			}),
			"utf8",
		);

		const resolved = await resolveEntryFile(
			fixture.pieElementsNgRoot,
			"@pie-element/simple-cloze",
			"browser/delivery/index.js",
		);

		expect(resolved?.file).toContain(
			"/packages/elements-svelte/simple-cloze/dist/browser/delivery/index.js",
		);
		expect(resolved?.distPath).toBe("browser/delivery/index.js");
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

	it("reports healthy when only shared packages are built", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);
		await writePackageFile({
			pieElementsNgRoot: fixture.pieElementsNgRoot,
			scope: "@pie-elements-ng",
			name: "shared-math-rendering",
			relativePath: "index.js",
			content: "export const ok = true;",
		});

		const response = await handleRequest(
			makeRequest("/health"),
			createFixtureContext(fixture),
		);

		expect(response.status).toBe(200);
		const body = await readJson<{
			ok: boolean;
			builtSharedPackages: number;
			sampleShared?: string;
		}>(response);
		expect(body.ok).toBe(true);
		expect(body.builtSharedPackages).toBe(1);
		expect(body.sampleShared).toBe("math-rendering");
	});

	it("serves the npm package layout the jsDelivr provider requests", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);
		const pkg = {
			pieElementsNgRoot: fixture.pieElementsNgRoot,
			scope: "@pie-element" as const,
			name: "multiple-choice",
		};
		await writePackageFile({
			...pkg,
			relativePath: "index.js",
			content: "export {};",
		});
		await writePackageFile({
			...pkg,
			relativePath: "browser/delivery/index.js",
			content: `import { Radio } from "../Radio-90M7O0Rk.js"; export default Radio;`,
		});
		await writePackageFile({
			...pkg,
			relativePath: "browser/Radio-90M7O0Rk.js",
			content: "export class Radio {}",
		});
		const exportsMap = {
			"./browser/delivery": { default: "./dist/browser/delivery/index.js" },
		};
		await writePackageJson({
			...pkg,
			content: { name: "@pie-element/multiple-choice", exports: exportsMap },
		});
		const context = createFixtureContext(fixture);
		const base = "/@pie-element/multiple-choice@13.4.0-next.13";

		const metadata = await handleRequest(
			makeRequest(`${base}/package.json`),
			context,
		);
		expect(metadata.status).toBe(200);
		expect(metadata.headers.get("content-type")).toContain("application/json");
		expect(
			(await readJson<{ exports: unknown }>(metadata)).exports,
		).toEqual(exportsMap);

		const view = await handleRequest(
			makeRequest(`${base}/dist/browser/delivery/index.js`),
			context,
		);
		expect(view.status).toBe(200);
		expect(await view.text()).toContain(
			'"/@pie-element/multiple-choice/browser/Radio-90M7O0Rk.js"',
		);

		const chunk = await handleRequest(
			makeRequest("/@pie-element/multiple-choice/browser/Radio-90M7O0Rk.js"),
			context,
		);
		expect(chunk.status).toBe(200);
		expect(chunk.headers.get("x-local-esm-cdn-file")).toContain(
			"/multiple-choice/dist/browser/Radio-90M7O0Rk.js",
		);
	});

	it("resolves a directory request's relative imports against the file it serves", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);
		const pkg = {
			pieElementsNgRoot: fixture.pieElementsNgRoot,
			scope: "@pie-lib" as const,
			name: "render-ui",
		};
		await writePackageFile({
			...pkg,
			relativePath: "index.js",
			content: "export {};",
		});
		await writePackageFile({
			...pkg,
			relativePath: "controller/index.js",
			content: `export { defaults } from "./defaults.js";`,
		});
		await writePackageFile({
			...pkg,
			relativePath: "controller/defaults.js",
			content: "export const defaults = {};",
		});
		const context = createFixtureContext(fixture);

		const controller = await handleRequest(
			makeRequest("/@pie-lib/render-ui/controller"),
			context,
		);
		expect(controller.status).toBe(200);
		expect(await controller.text()).toContain(
			'"/@pie-lib/render-ui/controller/defaults.js"',
		);

		const aliased = await handleRequest(
			makeRequest("/@pie-lib/render-ui/defaults.js"),
			context,
		);
		expect(aliased.status).toBe(404);
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
