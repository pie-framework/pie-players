import { describe, expect, test } from "bun:test";

import { collectSpecifiers } from "../check-deps.mjs";

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
});
