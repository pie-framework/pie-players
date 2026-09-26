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

function request(middlewares: Middleware[], url: string) {
	return new Promise<{ status?: number; body?: string; passed: boolean }>(
		(resolve, reject) => {
			const res = {
				statusCode: 0,
				setHeader() {},
				end(body: string) {
					resolve({ status: res.statusCode, body, passed: false });
				},
			};
			const [middleware] = middlewares;
			middleware(
				{ url } as IncomingMessage,
				res as unknown as ServerResponse,
				(err) => (err ? reject(err) : resolve({ passed: true })),
			);
		},
	);
}

describe("local-esm-cdn Vite adapter", () => {
	it("answers a package's package.json, which Vite does not transform", async () => {
		const { middlewares } = await pluginForFixture();

		const metadata = await request(
			middlewares,
			"/@pie-element/multiple-choice@1.0.0/package.json",
		);
		expect(metadata.status).toBe(200);
		expect(JSON.parse(metadata.body ?? "{}").version).toBe("1.0.0");

		const module = await request(
			middlewares,
			"/@pie-element/multiple-choice@1.0.0/dist/browser/delivery/index.js",
		);
		expect(module.passed).toBe(true);
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
