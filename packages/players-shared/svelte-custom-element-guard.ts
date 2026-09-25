/**
 * Guards the registration Svelte compiles into every custom element that names
 * its tag, so a second copy of a package loads into a document holding the
 * first.
 *
 * A component whose `svelte:options` declares a `customElement` tag compiles to
 * a module-scope `customElements.define` with no guard. A second copy of the
 * package in one document — a CDN build beside an npm install, two versions of
 * one tool, or a host that registered the tag itself — then throws
 * `NotSupportedError` and rejects the module that imported it. This plugin
 * routes that call through a helper that leaves a registered tag alone, so the
 * copy that registered first keeps rendering every instance: the rule
 * `definePieItemPlayer` and the toolkit's custom-element build already follow.
 *
 * Every Vite build that compiles Svelte custom elements lists this plugin, and
 * `check:bundle-safety` fails on an unguarded literal-tag define in any
 * published `dist`, which is what a build without it emits.
 *
 * Lives at the package root beside `svelte-source-aliases.ts`, outside `src/`,
 * so it never lands in `dist`.
 */

const SVELTE_MODULE_ID = /\.svelte(?:\?.*)?$/;
const DEFINE_CALL = /(?<![\w$.])customElements\.define\s*\(/g;
const GUARDED_DEFINE = "__pieDefineCustomElement";

// Appended rather than prepended, so every line Svelte emitted keeps the
// position its sourcemap gave it. The declaration is hoisted.
const GUARDED_DEFINE_SOURCE = `
function ${GUARDED_DEFINE}(tagName, elementConstructor) {
	if (!customElements.get(tagName)) {
		customElements.define(tagName, elementConstructor);
	}
}
`;

export interface SvelteCustomElementGuardPlugin {
	name: string;
	enforce: "post";
	transform(code: string, id: string): { code: string; map: null } | null;
}

/** The Vite plugin; list it after `svelte()` so it sees compiled output. */
export function guardSvelteCustomElementDefines(): SvelteCustomElementGuardPlugin {
	return {
		name: "pie-guard-svelte-custom-element-defines",
		enforce: "post",
		transform(code, id) {
			if (!SVELTE_MODULE_ID.test(id)) return null;
			// The helper's own define must never be rewritten into a call to itself.
			if (code.includes(GUARDED_DEFINE)) return null;
			const guarded = code.replace(DEFINE_CALL, `${GUARDED_DEFINE}(`);
			if (guarded === code) return null;
			return { code: `${guarded}\n${GUARDED_DEFINE_SOURCE}`, map: null };
		},
	};
}
