import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { declarationExports, probeEntries } from "../check-ce-composition.mjs";

const fixtures = [];
afterEach(() => {
	for (const directory of fixtures.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture(runtime, declarations = "export {};", tags = []) {
	const directory = mkdtempSync(path.join(os.tmpdir(), "pie-ce-check-test-"));
	fixtures.push(directory);
	const packageDir = path.join(directory, "node_modules", "fixture-element");
	mkdirSync(packageDir, { recursive: true });
	writeFileSync(path.join(directory, "package.json"), JSON.stringify({ type: "module" }));
	writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({
		name: "fixture-element", type: "module", exports: { ".": { types: "./index.d.ts", import: "./index.js" } },
	}));
	writeFileSync(path.join(packageDir, "index.js"), runtime);
	writeFileSync(path.join(packageDir, "index.d.ts"), declarations);
	const exports = declarationExports(directory, ["fixture-element"]).get("fixture-element");
	return { directory, entries: [{ specifier: "fixture-element", exports, tags }] };
}

test("rejects an advertised value absent from the installed runtime", () => {
	const { directory, entries } = fixture("export {};", "export declare const promised: string;");
	expect(() => probeEntries(directory, entries)).toThrow("differ from declarations");
});

test("accepts type-only re-exports without requiring a runtime constructor", () => {
	const { directory, entries } = fixture("export {};", 'export type { PrivateImplementation as PublicElement } from "./implementation.js";');
	writeFileSync(path.join(directory, "node_modules/fixture-element/implementation.d.ts"), "export declare class PrivateImplementation extends HTMLElement {}");
	entries[0].exports = declarationExports(directory, ["fixture-element"]).get("fixture-element");
	expect(entries[0].exports).toEqual([]);
	expect(() => probeEntries(directory, entries)).not.toThrow();
});

test("rejects a registration entry that omits its advertised tag", () => {
	const { directory, entries } = fixture("export {};", "export {};", ["pie-missing"]);
	expect(() => probeEntries(directory, entries)).toThrow("did not register pie-missing");
});

test("rejects a contract that registers a custom element in a browser", () => {
	const { directory, entries } = fixture('customElements.define("pie-contract-leak", class extends HTMLElement {}); export {};');
	expect(() => probeEntries(directory, entries, { inert: true })).toThrow("Contract imports registered pie-contract-leak");
});

test("evaluates a second artifact copy and catches an unguarded definition", () => {
	const { directory, entries } = fixture('customElements.define("pie-unguarded", class extends HTMLElement {}); export {};', "export {};", ["pie-unguarded"]);
	entries[0].duplicate = true;
	expect(() => probeEntries(directory, entries)).toThrow();
});

test("allows the documented NDS vendor registration and rejects other implementation tags", () => {
	const allowed = fixture('customElements.define("nds-icon-button", class extends HTMLElement {}); export {};');
	expect(() => probeEntries(allowed.directory, allowed.entries)).not.toThrow();
	const leaked = fixture('customElements.define("vendor-private-widget", class extends HTMLElement {}); export {};');
	expect(() => probeEntries(leaked.directory, leaked.entries)).toThrow("Unexpected implementation registrations");
});
