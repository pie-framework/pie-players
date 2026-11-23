import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");
const MEDIA_PROJECTS = [
	"a11y-forced-colors-light",
	"a11y-forced-colors-dark",
	"a11y-reduced-motion",
];

/** The player configs whose specs run axe, and the directory each one's specs live in. */
const CONFIGS = {
	"packages/item-player/playwright.config.ts": "packages/item-player/tests",
	"packages/section-player/playwright.config.ts": "packages/section-player/tests",
	"packages/assessment-player/playwright.config.ts": "packages/assessment-player/tests",
	"packages/calculator-cortex/playwright.config.ts": "packages/calculator-cortex/e2e",
};

/**
 * Each config's projects, read in a process of its own: the module cache would
 * otherwise hand back a config another test imported without the variable.
 */
function projectsOf(env) {
	const files = Object.keys(CONFIGS).map((file) => path.join(REPO_ROOT, file));
	const script = `
		const out = {};
		for (const file of ${JSON.stringify(files)}) {
			const { default: config } = await import(file);
			out[file] = config.projects.map((project) => ({
				name: project.name,
				testMatch: project.testMatch?.source,
				grep: project.grep?.source,
				use: project.use,
			}));
		}
		console.log(JSON.stringify(out));
	`;
	const { PIE_E2E_A11Y_MEDIA: _unset, ...rest } = process.env;
	const result = spawnSync(process.execPath, ["-e", script], {
		cwd: REPO_ROOT,
		env: { ...rest, ...env },
		encoding: "utf8",
	});
	expect(result.status, result.stderr).toBe(0);
	return Object.fromEntries(
		Object.entries(JSON.parse(result.stdout)).map(([file, projects]) => [
			path.relative(REPO_ROOT, file),
			projects,
		]),
	);
}

function walkSpecs(dir) {
	return readdirSync(dir, { withFileTypes: true, recursive: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".spec.ts"))
		.map((entry) => path.join(entry.parentPath, entry.name));
}

describe("a11y media projects", () => {
	test("stay out of every run that does not opt in", () => {
		for (const [file, projects] of Object.entries(projectsOf({}))) {
			const names = projects.map((project) => project.name);
			expect({ file, media: names.filter((name) => name.startsWith("a11y-")) }).toEqual({
				file,
				media: [],
			});
			expect(names).toContain("chromium");
		}
	});

	test("join each player config from the one definition", () => {
		for (const [file, projects] of Object.entries(
			projectsOf({ PIE_E2E_A11Y_MEDIA: "1" }),
		)) {
			const media = projects.filter((project) => project.name.startsWith("a11y-"));
			expect({ file, names: media.map((project) => project.name) }).toEqual({
				file,
				names: MEDIA_PROJECTS,
			});
			for (const project of media) {
				expect(project.use.defaultBrowserType).toBe("chromium");
				expect(project.grep).toBe("@axe\\b");
				expect(project.testMatch).toBe(media[0].testMatch);
			}
			const [light, dark, motion] = media;
			expect([light.use.forcedColors, light.use.colorScheme]).toEqual(["active", "light"]);
			expect([dark.use.forcedColors, dark.use.colorScheme]).toEqual(["active", "dark"]);
			expect(motion.use.reducedMotion).toBe("reduce");
		}
	});

	test("run every axe spec and no other spec", () => {
		const axeSpecs = Object.values(CONFIGS)
			.flatMap((dir) => walkSpecs(path.join(REPO_ROOT, dir)))
			.filter((file) => readFileSync(file, "utf8").includes('from "@axe-core/playwright"'));
		expect(axeSpecs.length).toBeGreaterThanOrEqual(10);

		const projects = projectsOf({ PIE_E2E_A11Y_MEDIA: "1" });
		for (const [file, dir] of Object.entries(CONFIGS)) {
			const testMatch = new RegExp(
				projects[file].find((project) => project.name.startsWith("a11y-")).testMatch,
			);
			const specs = walkSpecs(path.join(REPO_ROOT, dir));
			const matched = specs.filter((spec) => testMatch.test(spec)).sort();
			const expected = specs.filter((spec) => axeSpecs.includes(spec)).sort();
			expect({ file, specs: matched.map((spec) => path.relative(REPO_ROOT, spec)) }).toEqual({
				file,
				specs: expected.map((spec) => path.relative(REPO_ROOT, spec)),
			});
		}

		for (const spec of axeSpecs) {
			const source = readFileSync(spec, "utf8");
			const relative = path.relative(REPO_ROOT, spec);
			expect({ relative, tagged: source.includes('{ tag: "@axe" }') }).toEqual({
				relative,
				tagged: true,
			});
			expect({ relative, checked: source.includes("checkMedia(page,") }).toEqual({
				relative,
				checked: true,
			});
		}
	});
});
