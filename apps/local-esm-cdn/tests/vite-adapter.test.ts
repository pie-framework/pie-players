import { afterEach, describe, expect, it } from "bun:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { createVitePlugin } from "../src/adapters/vite.ts";
import {
	createTempFixture,
	writePackageFile,
	writePackageJson,
} from "./fixtures.ts";

type Middleware = (
	req: IncomingMessage,
	res: ServerResponse,
	next: (err?: unknown) => void,
) => void;

// A woff2 signature followed by bytes that are not UTF-8.
const FONT = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x00, 0xff, 0xfe, 0x80]);

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
	while (cleanups.length) {
		await cleanups.pop()?.();
	}
});

async function pluginForFixture() {
	const fixture = await createTempFixture();
	cleanups.push(fixture.cleanup);
	const pkg = {
		pieElementsNgRoot: fixture.pieElementsNgRoot,
		scope: "@pie-element" as const,
		name: "multiple-choice",
	};
	await writePackageFile({
		...pkg,
		relativePath: "browser/delivery/index.js",
		content: `import { Radio } from "../Radio-90M7O0Rk.js"; export default Radio;`,
	});
	await writePackageFile({ ...pkg, relativePath: "index.js", content: "" });
	await writePackageFile({
		...pkg,
		relativePath: "browser/assets/Symbola-4c507403.woff2",
		content: FONT,
	});
	await writePackageFile({
		...pkg,
		relativePath: "browser/mathquill-Bq3k.js",
		content: `export const font = new URL("./assets/Symbola-4c507403.woff2", import.meta.url);`,
	});
	await writePackageFile({
		...pkg,
		relativePath: "browser/editor-runtime/delivery/index.js",
		content: `import { Editor } from "@tiptap/core"; import { main } from "../main-By6Ldawu.js"; export default main(Editor);`,
	});
	await writePackageFile({
		...pkg,
		relativePath: "browser/editor-runtime/main-By6Ldawu.js",
		content: `export const main = (Editor) => Editor;`,
	});
	await writePackageJson({
		...pkg,
		content: {
			name: "@pie-element/multiple-choice",
			version: "1.0.0",
			pie: {
				browserEditorRuntime: {
					name: "@pie-element/shared-editor-runtime",
					version: "0.1.1-next.0",
					views: { delivery: "editor-runtime/delivery" },
				},
			},
		},
	});
	await writePackageJson({
		pieElementsNgRoot: fixture.pieElementsNgRoot,
		scope: "@pie-element",
		name: "shared-editor-runtime",
		content: {
			name: "@pie-element/shared-editor-runtime",
			version: "0.1.1-next.0",
			pie: { browserModules: { "@tiptap/core": "tiptap-core" } },
		},
	});

	// An element a preloaded host imports bare, with a controller not built.
	const bareImported = { ...pkg, name: "hotspot" };
	await writePackageFile({
		...bareImported,
		relativePath: "browser/delivery/index.js",
		content: "export default class Hotspot extends HTMLElement {}",
	});
	await writePackageJson({
		...bareImported,
		content: {
			name: "@pie-element/hotspot",
			version: "2.0.0",
			exports: {
				"./browser/delivery": {
					types: "./dist/delivery/index.d.ts",
					default: "./dist/browser/delivery/index.js",
				},
				"./browser/controller": {
					default: "./dist/browser/controller/index.js",
				},
				"./package.json": "./package.json",
			},
		},
	});

	const plugin = createVitePlugin({
		pieElementsNgRoot: fixture.pieElementsNgRoot,
		piePlayersRoot: fixture.piePlayersRoot,
		esmShBaseUrl: "https://esm.sh",
	});
	const middlewares: Middleware[] = [];
	const server = {
		middlewares: { use: (fn: Middleware) => middlewares.push(fn) },
		watcher: { add() {}, on() {} },
	};
	(plugin.configureServer as (s: unknown) => void)(server);
	return { plugin, middlewares, pieElementsNgRoot: fixture.pieElementsNgRoot };
}

type Answer = {
	status?: number;
	headers?: Record<string, string>;
	body?: Buffer;
	passed: boolean;
};

function request(middlewares: Middleware[], url: string) {
	return new Promise<Answer>((resolve, reject) => {
		const headers: Record<string, string> = {};
		const res = {
			statusCode: 0,
			setHeader(key: string, value: string) {
				headers[key] = value;
			},
			end(body: Buffer) {
				resolve({ status: res.statusCode, headers, body, passed: false });
			},
		};
		const [middleware] = middlewares;
		middleware(
			{ url } as IncomingMessage,
			res as unknown as ServerResponse,
			(err) => (err ? reject(err) : resolve({ passed: true })),
		);
	});
}

describe("local-esm-cdn Vite adapter", () => {
	it("answers a package's package.json, which Vite does not transform", async () => {
		const { middlewares } = await pluginForFixture();

		const metadata = await request(
			middlewares,
			"/@pie-element/multiple-choice@1.0.0/package.json",
		);
		expect(metadata.status).toBe(200);
		expect(JSON.parse(String(metadata.body)).version).toBe("1.0.0");

		const module = await request(
			middlewares,
			"/@pie-element/multiple-choice@1.0.0/dist/browser/delivery/index.js",
		);
		expect(module.passed).toBe(true);
	});

	it("answers an editor-runtime variant's modules, whose runtime imports stay bare for the page's import map", async () => {
		const { middlewares } = await pluginForFixture();

		const view = await request(
			middlewares,
			"/@pie-element/multiple-choice@1.0.0/dist/browser/editor-runtime/delivery/index.js",
		);
		expect(view.status).toBe(200);
		expect(view.headers?.["content-type"]).toContain("javascript");
		expect(String(view.body)).toContain('from "@tiptap/core"');
		expect(String(view.body)).toContain(
			'"/@pie-element/multiple-choice/browser/editor-runtime/main-By6Ldawu.js"',
		);

		const chunk = await request(
			middlewares,
			"/@pie-element/multiple-choice/browser/editor-runtime/main-By6Ldawu.js",
		);
		expect(chunk.status).toBe(200);
	});

	it("answers a font a build's stylesheet addresses by URL, as its bytes", async () => {
		const { middlewares } = await pluginForFixture();

		const font = await request(
			middlewares,
			"/@pie-element/multiple-choice/browser/assets/Symbola-4c507403.woff2",
		);
		expect(font.status).toBe(200);
		expect(font.headers?.["content-type"]).toBe("font/woff2");
		expect(new Uint8Array(font.body ?? [])).toEqual(FONT);
	});

	it("leaves a module's relative asset URLs to resolve against its URL", async () => {
		const { plugin } = await pluginForFixture();
		const load = plugin.load as (id: string) => Promise<{ code: string }>;

		const module = await load(
			"/@pie-element/multiple-choice/browser/mathquill-Bq3k.js",
		);
		expect(module.code).toContain(
			'new URL(/* @vite-ignore */ "./assets/Symbola-4c507403.woff2", import.meta.url)',
		);
	});

	it("claims its own URL space and leaves other bare imports in node_modules", async () => {
		const { plugin } = await pluginForFixture();
		const resolveId = plugin.resolveId as (id: string) => unknown;

		expect(
			resolveId(
				"/@pie-element/multiple-choice@1.0.0/dist/browser/delivery/index.js",
			),
		).toEqual({
			id: "/@pie-element/multiple-choice@1.0.0/dist/browser/delivery/index.js",
			external: false,
		});
		// players-shared imports the npm math renderer, which the checkout lacks.
		expect(
			resolveId("@pie-lib/math-rendering-module/module/index.js"),
		).toBeNull();
	});

	it("resolves a bare element import to the checkout's file through the package's exports", async () => {
		const { plugin, pieElementsNgRoot } = await pluginForFixture();
		const resolveId = plugin.resolveId as (id: string) => Promise<string>;
		const packageRoot = path.join(
			pieElementsNgRoot,
			"packages/elements-react/hotspot",
		);

		expect(await resolveId("@pie-element/hotspot/browser/delivery")).toBe(
			path.join(packageRoot, "dist/browser/delivery/index.js"),
		);
		expect(await resolveId("@pie-element/hotspot/package.json")).toBe(
			path.join(packageRoot, "package.json"),
		);
	});

	it("fails a bare element import the checkout cannot answer instead of falling back to npm", async () => {
		const { plugin } = await pluginForFixture();
		const resolveId = plugin.resolveId as (id: string) => Promise<string>;

		await expect(
			resolveId("@pie-element/hotspot/browser/controller"),
		).rejects.toThrow("not found; build @pie-element/hotspot");
		await expect(
			resolveId("@pie-element/hotspot/browser/author"),
		).rejects.toThrow('exports no "./browser/author"');
		await expect(
			resolveId("@pie-element/match/browser/delivery"),
		).rejects.toThrow("@pie-element/match is not in");
	});

	it("lets the dev server serve the checkout's files", async () => {
		const { plugin, pieElementsNgRoot } = await pluginForFixture();
		const config = plugin.config as () => {
			server: { fs: { allow: string[] } };
		};

		expect(config().server.fs.allow).toEqual([pieElementsNgRoot]);
	});

	it("loads the npm layout's module URLs with chunk imports the resolver serves", async () => {
		const { plugin } = await pluginForFixture();
		const load = plugin.load as (id: string) => Promise<{ code: string }>;

		const view = await load(
			"/@pie-element/multiple-choice@1.0.0/dist/browser/delivery/index.js",
		);
		expect(view.code).toContain(
			'"/@pie-element/multiple-choice/browser/Radio-90M7O0Rk.js"',
		);
	});
});
