/**
 * The item player registers itself from one place.
 *
 * A generated `@pie-players/pie-preloaded-player` build ships a second copy of
 * this package into a document that usually already has one. That copy only
 * loads while nothing else reaches the registry: Svelte's own
 * `customElements.define` is emitted when `svelte:options customElement`
 * carries a `tag`, runs at module scope and is unguarded, so the second copy
 * would throw `NotSupportedError` and reject the bundle that imported it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const readSource = (relativePath: string): string =>
	readFileSync(join(import.meta.dir, relativePath), "utf8");

describe("item-player registration contract", () => {
	test("the component declares no custom-element tag", () => {
		const source = readSource("../src/PieItemPlayer.svelte");
		const options = source.slice(
			source.indexOf("<svelte:options"),
			source.indexOf("/>"),
		);

		expect(options).toContain("customElement={{");
		expect(options).not.toMatch(/\btag:/);
	});

	test("definePieItemPlayer registers the compiled custom-element class", () => {
		const source = readSource("../src/pie-item-player.ts");
		const define = source.slice(
			source.indexOf("export function definePieItemPlayer"),
		);

		// `.element` is where Svelte puts the class when no tag is declared; the
		// component export itself is the component function.
		expect(define).toContain("PieItemPlayer as unknown as");
		expect(define).toContain(".element");
		// Registering one class under a second tag is a duplicate-constructor
		// error in the browser, which the wrapped fallback absorbs.
		expect(define).toContain("allowWrappedFallback: true");
		expect(source).toContain("definePieItemPlayer();");
	});
});
