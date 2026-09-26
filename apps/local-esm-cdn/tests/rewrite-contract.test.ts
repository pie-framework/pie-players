import { describe, expect, it } from "bun:test";
import { rewriteImports } from "../src/rewrite-imports.ts";

describe("local-esm-cdn import rewriting contract", () => {
	it("rewrites external and PIE package imports", async () => {
		const externalDep = ["rea", "ct"].join("");
		const pieLibDep = ["@pie-lib", "render-ui"].join("/");
		const pieElementDep = ["@pie-element", "hotspot"].join("/");
		const source = `
      import React from "${externalDep}";
      import { render } from "${pieLibDep}";
      import hotspot from "${pieElementDep}";
    `;
		const rewritten = await rewriteImports(source, {
			esmShBaseUrl: "https://esm.sh",
		});

		expect(rewritten).toContain('from "https://esm.sh/react@18.2.0"');
		expect(rewritten).toContain('from "/@pie-lib/render-ui"');
		expect(rewritten).toContain('from "/@pie-element/hotspot"');
	});

	it("pins React shared dependency subpaths to the player-owned browser versions", async () => {
		const source = `
      import ReactDom from "react-dom";
      import { createRoot } from "react-dom/client";
      import { jsx } from "react/jsx-runtime";
    `;
		const rewritten = await rewriteImports(source, {
			esmShBaseUrl: "https://esm.sh",
		});

		expect(rewritten).toContain('from "https://esm.sh/react-dom@18.2.0"');
		expect(rewritten).toContain(
			'from "https://esm.sh/react-dom@18.2.0/client"',
		);
		expect(rewritten).toContain(
			'from "https://esm.sh/react@18.2.0/jsx-runtime"',
		);
	});

	it("resolves relative imports against the importing module's path", async () => {
		const packageId = ["@pie-lib", "render-ui"].join("/");
		const source = `
      import x from "./feedback.js";
      import y from "../tokens.js";
    `;
		const rewritten = await rewriteImports(source, {
			esmShBaseUrl: "https://esm.sh",
			pkg: packageId,
			modulePath: "controller/index.js",
		});

		expect(rewritten).toContain('"/@pie-lib/render-ui/controller/feedback.js"');
		expect(rewritten).toContain('"/@pie-lib/render-ui/tokens.js"');
	});

	it("maps a browser view's chunk imports to the shared browser directory", async () => {
		const packageId = ["@pie-element", "multiple-choice"].join("/");
		const view = await rewriteImports(
			`import { a } from "../Radio-90M7O0Rk.js";`,
			{
				esmShBaseUrl: "https://esm.sh",
				pkg: packageId,
				modulePath: "browser/delivery/index.js",
			},
		);
		const chunk = await rewriteImports(
			`import { b } from "./Radio-90M7O0Rk.js";`,
			{
				esmShBaseUrl: "https://esm.sh",
				pkg: packageId,
				modulePath: "browser/main-Ch9DU_mG.js",
			},
		);

		expect(view).toContain(
			'"/@pie-element/multiple-choice/browser/Radio-90M7O0Rk.js"',
		);
		expect(chunk).toContain(
			'"/@pie-element/multiple-choice/browser/Radio-90M7O0Rk.js"',
		);
	});

	it("leaves a relative import that leaves the package's dist unrewritten", async () => {
		const packageId = ["@pie-lib", "render-ui"].join("/");
		const rewritten = await rewriteImports(`import x from "../outside.js";`, {
			esmShBaseUrl: "https://esm.sh",
			pkg: packageId,
			modulePath: "index.js",
		});

		expect(rewritten).toContain('"../outside.js"');
	});

	it("rewrites bun node_modules relative imports to esm CDN", async () => {
		const packageId = ["@pie-lib", "render-ui"].join("/");
		const source = `
      import {
        CSSTransition
      } from "./node_modules/.bun/react-transition-group@4.4.5_abc/node_modules/react-transition-group/esm/CSSTransition.js";
    `;
		const rewritten = await rewriteImports(source, {
			esmShBaseUrl: "https://esm.sh",
			pkg: packageId,
			modulePath: "index.js",
		});

		expect(rewritten).toContain(
			"https://esm.sh/react-transition-group/esm/CSSTransition.js",
		);
	});

	it("leaves import.meta expressions untouched", async () => {
		const source = `const href = new URL("./worker.js", import.meta.url).href;`;
		const rewritten = await rewriteImports(source, {
			esmShBaseUrl: "https://esm.sh",
			pkg: ["@pie-element", "multiple-choice"].join("/"),
			modulePath: "browser/author/index.js",
		});

		expect(rewritten).toBe(source);
	});

	it("rewrites string-literal dynamic imports but not expression imports", async () => {
		const externalDep = ["rea", "ct"].join("");
		const packageId = ["@pie-lib", "render-ui"].join("/");
		const source = `
      const a = import("${externalDep}");
      const b = import(dynamicSpecifier);
      const c = import("./chunk.js");
    `;
		const rewritten = await rewriteImports(source, {
			esmShBaseUrl: "https://esm.sh",
			pkg: packageId,
			modulePath: "index.js",
		});

		expect(rewritten).toContain('import("https://esm.sh/react@18.2.0")');
		expect(rewritten).toContain("import(dynamicSpecifier)");
		expect(rewritten).toContain('import("/@pie-lib/render-ui/chunk.js")');
	});
});
