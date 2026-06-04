import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	buildEsmSmokeMatrix,
	createJsDelivrLocalMapper,
	findElementPackageDir,
	loadSampleForSlug,
	parseJsDelivrPieUrl,
} from "../lib/pie-elements-ng-esm-smoke.mjs";

const cleanups = [];

afterEach(async () => {
	while (cleanups.length) {
		const cleanup = cleanups.pop();
		if (cleanup) await cleanup();
	}
});

async function createFixture() {
	const root = await mkdtemp(path.join(tmpdir(), "pie-elements-ng-smoke-"));
	cleanups.push(() => rm(root, { recursive: true, force: true }));
	await mkdir(path.join(root, ".compatibility"), { recursive: true });
	await mkdir(
		path.join(root, "apps", "element-demo", "src", "lib", "samples"),
		{
			recursive: true,
		},
	);
	return root;
}

async function writeJson(filePath, value) {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function writeElementPackage(
	root,
	{ workspace, slug, pkg = {}, files = {} },
) {
	const packageDir = path.join(root, "packages", workspace, slug);
	await mkdir(packageDir, { recursive: true });
	await writeJson(path.join(packageDir, "package.json"), {
		name: `@pie-element/${slug}`,
		type: "module",
		exports: {
			"./browser/delivery": {
				default: "./dist/browser/delivery/index.js",
			},
			"./browser/controller": {
				default: "./dist/browser/controller/index.js",
			},
		},
		...pkg,
	});
	for (const [relativePath, content] of Object.entries(files)) {
		const target = path.join(packageDir, relativePath);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, content, "utf8");
	}
	return packageDir;
}

describe("pie-elements-ng ESM smoke matrix helpers", () => {
	test("resolves React and Svelte element package directories", async () => {
		const root = await createFixture();
		const reactDir = await writeElementPackage(root, {
			workspace: "elements-react",
			slug: "multiple-choice",
		});
		const svelteDir = await writeElementPackage(root, {
			workspace: "elements-svelte",
			slug: "simple-cloze",
		});

		expect(findElementPackageDir(root, "multiple-choice")).toBe(reactDir);
		expect(findElementPackageDir(root, "simple-cloze")).toBe(svelteDir);
		expect(findElementPackageDir(root, "not-real")).toBeNull();
	});

	test("loads the first usable element-demo sample for a slug", async () => {
		const root = await createFixture();
		await writeJson(
			path.join(
				root,
				"apps",
				"element-demo",
				"src",
				"lib",
				"samples",
				"simple-cloze.json",
			),
			{
				demos: [
					{
						id: "basic",
						model: {
							id: "model-1",
							element: "simple-cloze",
							prompt: "What is 2 + 2?",
						},
						session: {
							id: "model-1",
							element: "simple-cloze",
							response: "4",
						},
					},
				],
			},
		);

		const sample = await loadSampleForSlug(root, "simple-cloze");

		expect(sample.fixtureId).toBe("basic");
		expect(sample.elementTag).toBe("simple-cloze");
		expect(sample.model.id).toBe("model-1");
		expect(sample.markup).toBe('<simple-cloze id="model-1"></simple-cloze>');
		expect(sample.registrationOnly).toBe(false);
	});

	test("uses real samples whose authored element tag differs from package slug", async () => {
		const root = await createFixture();
		await writeJson(
			path.join(
				root,
				"apps",
				"element-demo",
				"src",
				"lib",
				"samples",
				"hotspot.json",
			),
			{
				demos: [
					{
						id: "hotspot-basic",
						model: {
							id: "hotspot-1",
							element: "hotspot-element",
							prompt: "Select a region",
						},
						session: {
							id: "hotspot-1",
							element: "hotspot-element",
						},
					},
				],
			},
		);

		const sample = await loadSampleForSlug(root, "hotspot");

		expect(sample.fixtureId).toBe("hotspot-basic");
		expect(sample.elementTag).toBe("hotspot-element");
		expect(sample.markup).toBe(
			'<hotspot-element id="hotspot-1"></hotspot-element>',
		);
		expect(sample.registrationOnly).toBe(false);
	});

	test("fills the inferred element tag when a real sample omits model.element", async () => {
		const root = await createFixture();
		await writeJson(
			path.join(
				root,
				"apps",
				"element-demo",
				"src",
				"lib",
				"samples",
				"explicit-constructed-response.json",
			),
			{
				demos: [
					{
						id: "ecr-basic",
						model: {
							id: "ecr-1",
							prompt: "Explain your answer.",
						},
						session: {
							id: "ecr-1",
							value: "",
						},
					},
				],
			},
		);

		const sample = await loadSampleForSlug(
			root,
			"explicit-constructed-response",
		);

		expect(sample.fixtureId).toBe("ecr-basic");
		expect(sample.elementTag).toBe("explicit-constructed-response");
		expect(sample.model.element).toBe("explicit-constructed-response");
		expect(sample.session.element).toBe("explicit-constructed-response");
		expect(sample.registrationOnly).toBe(false);
	});

	test("builds a matrix for every browser-ready package and rejects unsupported reports", async () => {
		const root = await createFixture();
		await writeJson(path.join(root, ".compatibility", "report.json"), {
			browserEsmReady: ["multiple-choice", "simple-cloze"],
			browserEsmUnsupported: {},
		});
		await writeElementPackage(root, {
			workspace: "elements-react",
			slug: "multiple-choice",
			pkg: {
				pie: {
					browserSharedDependencies: {
						react: "18.2.0",
						"react-dom": "18.2.0",
					},
				},
			},
		});
		await writeElementPackage(root, {
			workspace: "elements-svelte",
			slug: "simple-cloze",
		});
		await writeJson(
			path.join(
				root,
				"apps",
				"element-demo",
				"src",
				"lib",
				"samples",
				"multiple-choice.json",
			),
			{
				demos: [
					{
						id: "mc",
						model: { id: "1", element: "multiple-choice" },
						session: { id: "1", element: "multiple-choice" },
					},
				],
			},
		);

		const matrix = await buildEsmSmokeMatrix({ pieElementsNgRoot: root });

		expect(matrix.map((entry) => entry.slug)).toEqual([
			"multiple-choice",
			"simple-cloze",
		]);
		expect(matrix[0].kind).toBe("react");
		expect(matrix[1].kind).toBe("svelte");
		expect(matrix[1].elementTag).toBe("simple-cloze");
		expect(matrix[1].sharedDependencies).toEqual({});
		expect(matrix[1].registrationOnly).toBe(true);

		await writeJson(path.join(root, ".compatibility", "report.json"), {
			browserEsmReady: ["multiple-choice"],
			browserEsmUnsupported: {
				"simple-cloze": { reason: "blocked" },
			},
		});
		await expect(
			buildEsmSmokeMatrix({ pieElementsNgRoot: root }),
		).rejects.toThrow(/browserEsmUnsupported/);
	});

	test("rejects publishable element packages omitted from the compatibility report", async () => {
		const root = await createFixture();
		await writeJson(path.join(root, ".compatibility", "report.json"), {
			browserEsmReady: ["multiple-choice"],
			browserEsmUnsupported: {},
		});
		await writeElementPackage(root, {
			workspace: "elements-react",
			slug: "multiple-choice",
		});
		await writeElementPackage(root, {
			workspace: "elements-svelte",
			slug: "simple-cloze",
		});

		await expect(
			buildEsmSmokeMatrix({ pieElementsNgRoot: root }),
		).rejects.toThrow(
			/Compatibility report is missing publishable element packages: simple-cloze/,
		);
	});

	test("maps jsDelivr package metadata, entrypoints, and chunk URLs to local CDN paths", () => {
		const mapper = createJsDelivrLocalMapper();

		expect(
			parseJsDelivrPieUrl(
				"https://cdn.jsdelivr.net/npm/@pie-element/simple-cloze@latest/package.json",
			),
		).toEqual({
			packageName: "@pie-element/simple-cloze",
			subpath: "package.json",
			localPath: "/@pie-element/simple-cloze@latest/package.json",
		});

		expect(
			mapper.toLocalCdnPath(
				"https://cdn.jsdelivr.net/npm/@pie-element/simple-cloze@latest/dist/browser/delivery/index.js",
			),
		).toBe("/@pie-element/simple-cloze@latest/browser/delivery/index.js");
		expect(
			mapper.toLocalCdnPath(
				"https://cdn.jsdelivr.net/@pie-element/simple-cloze/browser/delivery/client-abc.js",
			),
		).toBe("/@pie-element/simple-cloze/browser/client-abc.js");
		expect(
			mapper.toLocalCdnPath(
				"https://cdn.jsdelivr.net/npm/@pie-element/simple-cloze@latest/runtime-support/+esm",
			),
		).toBe("/@pie-element/simple-cloze@latest/runtime-support/+esm");
	});
});
