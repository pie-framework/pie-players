import { afterEach, describe, expect, it } from "bun:test";
import type { IncomingMessage, ServerResponse } from "node:http";
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
	await writePackageJson({
		...pkg,
		content: { name: "@pie-element/multiple-choice", version: "1.0.0" },
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
	return { plugin, middlewares };
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

	it("resolves only its own URL space, so the app's bare imports stay in node_modules", async () => {
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
		expect(
			resolveId("@pie-element/mc-populated-blank/browser/delivery"),
		).toBeNull();
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
