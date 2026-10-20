/**
 * Shared catalog-shape helpers for this package's scripts.
 *
 * The flattening rule is load-bearing in both directions: a plural group is
 * ONE leaf — matching how `MessageKey` and `plural()` treat it — recognized
 * by every one of its keys being a CLDR plural category, the same rule
 * `players-shared`'s `check-coverage.ts` applies. The gate and the
 * regeneration tooling must never disagree about what a key is, so the rule
 * lives here once.
 *
 * @module pie-i18n-generated/scripts/lib/catalog-shape
 */

export const PLURAL_CATEGORIES = new Set([
	"zero",
	"one",
	"two",
	"few",
	"many",
	"other",
]);

export const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export type PluralNode = Record<string, string>;

export type FlatLeaf =
	| { kind: "string"; value: string }
	| { kind: "plural"; value: PluralNode };

export function isPluralGroup(node: unknown): node is PluralNode {
	if (typeof node !== "object" || node === null || Array.isArray(node)) {
		return false;
	}
	const keys = Object.keys(node);
	return keys.length > 0 && keys.every((key) => PLURAL_CATEGORIES.has(key));
}

export function flatten(
	node: unknown,
	prefix: string,
	out: Map<string, FlatLeaf>,
): void {
	if (isPluralGroup(node)) {
		out.set(prefix, { kind: "plural", value: node });
		return;
	}
	if (typeof node === "string") {
		out.set(prefix, { kind: "string", value: node });
		return;
	}
	if (typeof node !== "object" || node === null) {
		throw new Error(`Unexpected leaf at ${prefix || "(root)"}`);
	}
	for (const [key, value] of Object.entries(node)) {
		flatten(value, prefix ? `${prefix}.${key}` : key, out);
	}
}

export function placeholders(text: string): Set<string> {
	return new Set(Array.from(text.matchAll(PLACEHOLDER), (m) => m[1]));
}
