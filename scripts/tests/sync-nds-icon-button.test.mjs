import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
	applyPiePatches,
	updateProvenance,
} from "../sync-nds-icon-button.mjs";

const vendorDir = resolve(
	import.meta.dir,
	"../../packages/players-shared/src/components/vendor/nds",
);

const built = `
function defineElement(tagName) { return (c) => c; }
class NdsIconButton {
	get buttonClasses() { return ["nds-icon-button", \`nds-icon-button--\${this.variant}\`]; }
	render() {
		return b\`
      <style>
        nds-icon-button {
          display: inline-block;
        }
        .nds-icon-button { display: inline-flex; }
      </style>\`;
	}
}
NdsIconButton = __decorate([defineElement("nds-icon-button")], NdsIconButton);
`;

describe("applyPiePatches", () => {
	test("renames the registered tag and its element selector, not the BEM classes", () => {
		const patched = applyPiePatches(built);
		expect(patched).toContain('defineElement("pie-nds-icon-button")');
		expect(patched).toMatch(/\spie-nds-icon-button \{\n\s+display: inline-block;/);
		expect(patched).toContain('["nds-icon-button", `nds-icon-button--');
		expect(patched).toContain(".nds-icon-button { display: inline-flex; }");
	});

	test("fails when upstream moved the define call", () => {
		const moved = built.replace('defineElement("nds-icon-button")', "defineElement(TAG)");
		expect(() => applyPiePatches(moved)).toThrow(/define decorator/);
	});

	test("fails when upstream dropped the element selector", () => {
		const moved = built.replace("nds-icon-button {\n", ":host {\n");
		expect(() => applyPiePatches(moved)).toThrow(/element selector/);
	});
});

describe("updateProvenance", () => {
	test("rewrites the release, commit and Lit rows", () => {
		const readme =
			"| Release | `v1.0.0` |\n| Source commit | `aaaaaaa` |\n| Inlined Lit | `3.0.0` |\n";
		expect(
			updateProvenance(readme, { release: "v5.6.0", commit: "a7ed2a9", lit: "3.3.3" }),
		).toBe("| Release | `v5.6.0` |\n| Source commit | `a7ed2a9` |\n| Inlined Lit | `3.3.3` |\n");
	});
});

describe("vendored nds-icon-button.js", () => {
	const bundle = readFileSync(resolve(vendorDir, "nds-icon-button.js"), "utf8");

	test("carries PIE's patches, so it can never register upstream's tag", () => {
		expect(bundle).toContain('defineElement("pie-nds-icon-button")');
		expect(bundle).not.toMatch(/defineElement\(["'`]nds-icon-button["'`]\)/);
		expect(bundle).toMatch(/\spie-nds-icon-button \{/);
	});

	test("keeps the inlined Lit licence notices", () => {
		expect(bundle).toContain("SPDX-License-Identifier: BSD-3-Clause");
	});

	test("matches the release the README records", () => {
		const readme = readFileSync(resolve(vendorDir, "README.md"), "utf8");
		const release = readme.match(/^\| Release \| `([^`]+)` \|$/m)?.[1];
		const commit = readme.match(/^\| Source commit \| `([^`]+)` \|$/m)?.[1];
		expect(bundle).toContain(`Vendored NDS icon button, ${release} (${commit})`);
	});
});
