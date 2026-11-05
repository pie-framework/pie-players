import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	checkLocaleLazyLoading,
	localeOfSpecifier,
} from "../check-locale-lazy-loading.mjs";

function write(root, relPath, content) {
	const absPath = path.join(root, relPath);
	mkdirSync(path.dirname(absPath), { recursive: true });
	writeFileSync(absPath, content);
}

function fixture(files) {
	const root = mkdtempSync(path.join(tmpdir(), "pie-locale-lazy-"));
	for (const [relPath, content] of Object.entries(files)) {
		write(root, relPath, content);
	}
	return root;
}

describe("localeOfSpecifier", () => {
	test("names a non-English locale file", () => {
		expect(localeOfSpecifier("./messages/nl-NL.js")).toBe("nl-NL");
		expect(localeOfSpecifier("./element-names/ar.json")).toBe("ar");
		expect(
			localeOfSpecifier("speech-rule-engine/lib/mathmaps/es.json"),
		).toBe("es");
		expect(localeOfSpecifier("./messages/zh-Hant.ts")).toBe("zh-Hant");
		expect(localeOfSpecifier("./messages/es-419.js")).toBe("es-419");
	});

	test("passes English, bare packages and ordinary names", () => {
		expect(localeOfSpecifier("./messages/en-US.js")).toBeNull();
		expect(localeOfSpecifier("speech-rule-engine/lib/mathmaps/en.json")).toBeNull();
		expect(localeOfSpecifier("node:fs")).toBeNull();
		expect(localeOfSpecifier("./types.js")).toBeNull();
		expect(localeOfSpecifier("./fs.js")).toBeNull();
		expect(localeOfSpecifier("@scope/pkg/nds-icon-button")).toBeNull();
		expect(localeOfSpecifier("./sc-voices.js")).toBeNull();
	});
});

describe("checkLocaleLazyLoading", () => {
	test("flags a static import of a locale file", () => {
		const root = fixture({
			"packages/tool/element-names.ts":
				'import ar from "./element-names/ar.json";\nexport { ar };\n',
			"packages/tool/tool.svelte":
				'<script lang="ts">\nimport nl from "./messages/nl-NL.js";\n</script>\n',
			"packages/tool/index.ts": 'export { default } from "./messages/fr.js";\n',
		});
		const { violations } = checkLocaleLazyLoading(root);
		expect(violations.map((v) => v.locale).sort()).toEqual(["ar", "fr", "nl-NL"]);
	});

	test("passes dynamic imports, type imports, English and tests", () => {
		const root = fixture({
			"packages/shared/catalogs.ts": [
				'import enUS from "./messages/en-US.js";',
				'import type nl from "./messages/nl-NL.js";',
				'export type { default as Fr } from "./messages/fr.js";',
				'const loaders = { "nl-NL": () => import("./messages/nl-NL.js") };',
			].join("\n"),
			"packages/shared/tests/catalogs.test.ts":
				'import nl from "../messages/nl-NL.js";\n',
			"packages/shared/scripts/check.ts": 'import nl from "../messages/nl-NL.js";\n',
		});
		expect(checkLocaleLazyLoading(root).violations).toEqual([]);
	});
});
