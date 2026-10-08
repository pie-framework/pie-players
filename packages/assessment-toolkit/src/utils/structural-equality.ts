/**
 * Structural equality for plain data: host-supplied policy inputs and session
 * payloads.
 *
 * Plain objects compare by own enumerable keys in any order, a key holding
 * `undefined` matching an absent one, and arrays compare by position. Every
 * other value compares with `Object.is`, so class instances, functions and
 * maps are equal only to themselves. A pair already under comparison counts as
 * equal, which keeps a cyclic value from recursing forever.
 */
export function structurallyEqual(a: unknown, b: unknown): boolean {
	return compare(a, b, new WeakMap());
}

function compare(
	a: unknown,
	b: unknown,
	inProgress: WeakMap<object, Set<object>>,
): boolean {
	if (Object.is(a, b)) return true;
	const aIsArray = Array.isArray(a);
	if (aIsArray !== Array.isArray(b)) return false;
	if (!aIsArray && (!isPlainObject(a) || !isPlainObject(b))) return false;
	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	if (aIsArray && (a as unknown[]).length !== (b as unknown[]).length) {
		return false;
	}

	let partners = inProgress.get(left);
	if (partners?.has(right)) return true;
	if (!partners) {
		partners = new Set();
		inProgress.set(left, partners);
	}
	partners.add(right);

	const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
	for (const key of keys) {
		if (!compare(left[key], right[key], inProgress)) return false;
	}
	return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}
