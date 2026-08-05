import { describe, expect, test } from "bun:test";

import { collectSpecifiers, declaresBuildEdge } from "../check-deps.mjs";

describe("check-deps import collection", () => {
	test("ignores import statements embedded in TypeScript string fixtures", () => {
		const source = `
			import { real } from "actual-package";

			const fixture = \`
				import ReactDom from "react-dom";
				import { createRoot } from "react-dom/client";
				import { jsx } from "react/jsx-runtime";
			\`;
		`;

		expect(collectSpecifiers(source, "fixture.ts")).toEqual(["actual-package"]);
	});

	test("collects dynamic imports, which optional workspace peers are loaded with", () => {
		const source = `
			const loaded = await import("@pie-players/pie-calculator-desmos");
		`;

		expect(collectSpecifiers(source, "provider.ts")).toEqual([
			"@pie-players/pie-calculator-desmos",
		]);
	});
});

describe("check-deps build-graph edges", () => {
	const target = "@pie-players/pie-calculator-desmos";

	test("counts dependencies and devDependencies", () => {
		expect(
			declaresBuildEdge({ dependencies: { [target]: "workspace:*" } }, target),
		).toBe(true);
		expect(
			declaresBuildEdge(
				{ devDependencies: { [target]: "workspace:*" } },
				target,
			),
		).toBe(true);
	});

	test("does not count a peer or optional declaration on its own", () => {
		// turbo 2.10 stopped deriving task-graph edges from peerDependencies, so a
		// peer-only declaration leaves the importing package's build unordered.
		expect(
			declaresBuildEdge(
				{
					peerDependencies: { [target]: "workspace:*" },
					peerDependenciesMeta: { [target]: { optional: true } },
				},
				target,
			),
		).toBe(false);
		expect(
			declaresBuildEdge(
				{ optionalDependencies: { [target]: "workspace:*" } },
				target,
			),
		).toBe(false);
	});

	test("counts a peer declaration that is also a devDependency", () => {
		expect(
			declaresBuildEdge(
				{
					peerDependencies: { [target]: "workspace:*" },
					devDependencies: { [target]: "workspace:*" },
				},
				target,
			),
		).toBe(true);
	});

	test("handles a manifest with no dependency sections", () => {
		expect(declaresBuildEdge({}, target)).toBe(false);
		expect(declaresBuildEdge(undefined, target)).toBe(false);
	});
});
