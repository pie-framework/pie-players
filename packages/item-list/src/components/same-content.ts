/**
 * Structural equality over plain objects and arrays; anything else, functions and class instances
 * included, compares by identity. A host that re-sets an equal `config` or `loaderOptions` object
 * keeps the row's summary and player.
 */
export function sameContent(a: unknown, b: unknown): boolean {
	return compare(a, b, new WeakMap());
}

/** `previous` when `next` has the same content, else `next`. */
export function keepEqual<T>(previous: T, next: T): T {
	return sameContent(previous, next) ? previous : next;
}

// A pair already under comparison counts as equal, so cyclic values terminate.
function compare(a: unknown, b: unknown, visiting: WeakMap<object, Set<object>>): boolean {
	if (Object.is(a, b)) return true;
	const arrays = Array.isArray(a) && Array.isArray(b);
	if (!arrays && !(isPlainObject(a) && isPlainObject(b))) return false;
	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	const partners = visiting.get(left) ?? new Set<object>();
	if (partners.has(right)) return true;
	partners.add(right);
	visiting.set(left, partners);
	const keys = Object.keys(left);
	return (
		keys.length === Object.keys(right).length &&
		keys.every((key) => Object.hasOwn(right, key) && compare(left[key], right[key], visiting))
	);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
