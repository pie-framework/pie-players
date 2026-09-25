import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { MathAwareSpeechChunk } from "../src/services/tts/math-aware-text-processing";
import { resolveMathSpeechFromChunks } from "../src/services/tts/math-speech";
import { sreLocaleSource } from "../src/services/tts/sre-locales";

const mathmapsDir = path.dirname(
	Bun.resolveSync("speech-rule-engine/lib/mathmaps/base.json", import.meta.dir),
);

const chunks: MathAwareSpeechChunk[] = [
	{
		type: "math",
		mathml: "<math><msup><mi>x</mi><mn>2</mn></msup></math>",
		fallbackText: "x 2",
	},
];

// SRE fetches its tables over HTTP where `window.document` exists, which is
// where the packaged tables apply.
const inBrowser = async <T>(run: () => T | Promise<T>): Promise<T> => {
	const scope = globalThis as { window?: unknown };
	const previous = scope.window;
	scope.window = { document: {} };
	try {
		return await run();
	} finally {
		scope.window = previous;
	}
};

const packagedLoader = () =>
	inBrowser(
		() => sreLocaleSource().custom as (locale: string) => Promise<unknown>,
	);

describe("SRE locale source", () => {
	test("hands SRE the packaged tables in a browser when the host names no source", async () => {
		const source = await inBrowser(() => sreLocaleSource({ subiso: "us" }));
		expect(Object.keys(source)).toEqual(["custom"]);
		expect(typeof source.custom).toBe("function");
	});

	test("leaves SRE on its own package directory outside a browser", () => {
		expect(sreLocaleSource({ subiso: "us" })).toEqual({});
	});

	test("leaves the packaged loader out when the host sets json", async () => {
		expect(
			await inBrowser(() =>
				sreLocaleSource({
					json: "https://example.test/mathmaps",
					subiso: "us",
				}),
			),
		).toEqual({ json: "https://example.test/mathmaps" });
	});

	test("passes a host custom loader through", async () => {
		const custom = async () => "{}";
		expect(await inBrowser(() => sreLocaleSource({ custom }))).toEqual({
			custom,
		});
	});

	test("the packaged loader serves base, en and es", async () => {
		const load = await packagedLoader();
		for (const locale of ["base", "en", "es"]) {
			const table = (await load(locale)) as Record<string, unknown>;
			// SRE keys every rule set in a table by the table's own locale.
			const keys = Object.keys(table);
			expect(keys.length).toBeGreaterThan(0);
			expect(keys.filter((key) => !key.startsWith(`${locale}/`))).toEqual([]);
		}
	});

	test("the packaged loader rejects every other locale", async () => {
		const load = await packagedLoader();
		for (const locale of ["de", "nemeth", "xx", "constructor"]) {
			await expect(load(locale)).rejects.toThrow(
				`no speech-rule-engine locale table is packaged for "${locale}"`,
			);
		}
	});

	test("setupEngine receives the packaged loader unless the host names a source", async () => {
		const setupCalls: Record<string, unknown>[] = [];
		const loadSre = async () => ({
			setupEngine: async (options: Record<string, unknown>) => {
				setupCalls.push(options);
			},
			engineReady: async () => {},
			toSpeech: () => "x squared",
		});
		const hostLoader = async () => "{}";

		await inBrowser(async () => {
			await resolveMathSpeechFromChunks(chunks, { loadSre });
			await resolveMathSpeechFromChunks(chunks, {
				loadSre,
				mathSpeech: {
					engineOptions: { json: "https://example.test/mathmaps" },
				},
			});
			await resolveMathSpeechFromChunks(chunks, {
				loadSre,
				mathSpeech: { engineOptions: { custom: hostLoader } },
			});
		});

		expect(typeof setupCalls[0].custom).toBe("function");
		expect(setupCalls[1]).toMatchObject({
			json: "https://example.test/mathmaps",
		});
		expect(setupCalls[1]).not.toHaveProperty("custom");
		expect(setupCalls[2].custom).toBe(hostLoader);
	});
});

// SRE loads `base` and `en` a few microtasks after it evaluates, from whatever
// source is set by then. A host's bundler evaluates SRE and the toolkit's
// `sre-engine` module in one synchronous pass, so the toolkit's source lands
// first; Bun loading SRE's CommonJS entry from source drains microtasks in
// between (see sre-engine.ts). So this bundles math speech as a host would and
// runs it with the globals that put SRE in browser mode, recording every
// request SRE makes for a table.
const PROBE = `
import { readFileSync } from "node:fs";

const mathmaps = process.env.PROBE_MATHMAPS;
const hostTables = "https://host.test/mathmaps/";
const requests = [];
globalThis.document = { documentElement: { querySelectorAll: () => [] } };
globalThis.window = { document: globalThis.document };
globalThis.XMLHttpRequest = class {
	open(_method, url) {
		this.url = url;
		requests.push(url);
	}
	send() {
		const table = this.url.startsWith(hostTables)
			? this.url.slice(hostTables.length)
			: undefined;
		this.readyState = 4;
		this.status = table ? 200 : 404;
		this.responseText = table ? readFileSync(mathmaps + "/" + table, "utf8") : "";
		queueMicrotask(() => this.onreadystatechange?.());
	}
};
const errors = [];
console.error = (...args) => errors.push(args.join(" "));
const loaded = [];
const engineOptions = {
	default: undefined,
	"host-json": { json: hostTables },
	"host-custom": {
		custom: async (locale) => {
			loaded.push(locale);
			return readFileSync(mathmaps + "/" + locale + ".json", "utf8");
		},
	},
}[process.env.PROBE_SCENARIO];

const { resolveMathSpeechFromChunks } = await import("./math-speech.js");
const chunks = ${JSON.stringify(chunks)};
const speech = [];
const report = (extra = []) =>
	console.log(JSON.stringify({ speech, errors: [...errors, ...extra], requests, loaded }));
const timer = setTimeout(() => {
	report(["SRE never became ready"]);
	process.exit(0);
}, 20_000);
for (const language of process.env.PROBE_LANGUAGES.split(",")) {
	const result = await resolveMathSpeechFromChunks(chunks, {
		language,
		...(engineOptions ? { mathSpeech: { engineOptions } } : {}),
	});
	speech.push(result.speechText);
}
clearTimeout(timer);
report();
process.exit(0);
`;

describe("SRE start-up in a host bundle", () => {
	let outdir = "";

	beforeAll(async () => {
		outdir = mkdtempSync(path.join(tmpdir(), "pie-sre-bundle-"));
		const build = await Bun.build({
			entrypoints: [
				path.join(import.meta.dir, "../src/services/tts/math-speech.ts"),
			],
			outdir,
			target: "bun",
			format: "esm",
			splitting: true,
		});
		if (!build.success) {
			throw new AggregateError(build.logs, "bundling math speech failed");
		}
		writeFileSync(path.join(outdir, "probe.mjs"), PROBE);
	});

	afterAll(() => {
		if (outdir) rmSync(outdir, { recursive: true, force: true });
	});

	const runProbe = (scenario: string, languages: string[]) => {
		const probe = Bun.spawnSync([process.execPath, "probe.mjs"], {
			cwd: outdir,
			env: {
				...process.env,
				PROBE_MATHMAPS: mathmapsDir,
				PROBE_SCENARIO: scenario,
				PROBE_LANGUAGES: languages.join(","),
			},
		});
		const output = probe.stdout.toString().trim().split("\n").at(-1) ?? "";
		try {
			return JSON.parse(output) as {
				speech: string[];
				errors: string[];
				requests: string[];
				loaded: string[];
			};
		} catch {
			throw new Error(
				`probe printed no result:\n${output}\n${probe.stderr.toString()}`,
			);
		}
	};

	test("loads the packaged locales from the packaged tables, with no request", () => {
		expect(runProbe("default", ["en-US", "es-ES"])).toEqual({
			speech: ["x squared", "x al cuadrado"],
			errors: [],
			requests: [],
			loaded: [],
		});
	}, 30_000);

	test("speaks a locale with no packaged table in English, with no request", () => {
		expect(runProbe("default", ["de-DE", "en-US"])).toEqual({
			speech: ["x squared", "x squared"],
			errors: ["Unable to load locale: de"],
			requests: [],
			loaded: [],
		});
	}, 30_000);

	test("fetches the start-up locales from a host json URL", () => {
		expect(runProbe("host-json", ["en-US"])).toEqual({
			speech: ["x squared"],
			errors: [],
			requests: [
				"https://host.test/mathmaps/base.json",
				"https://host.test/mathmaps/en.json",
			],
			loaded: [],
		});
	}, 30_000);

	test("loads the start-up locales through a host custom loader", () => {
		expect(runProbe("host-custom", ["en-US"])).toEqual({
			speech: ["x squared"],
			errors: [],
			requests: [],
			loaded: ["base", "en"],
		});
	}, 30_000);
});
