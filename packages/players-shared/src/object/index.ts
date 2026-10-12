/**
 * Merges objects left to right, skipping properties whose value is `null` or
 * `undefined`, so a later object's unset field never overrides an earlier
 * default the way object spread does.
 * @param objects The objects to merge.
 */
export const mergeObjectsIgnoringNullUndefined = <T extends object>(
	...objects: T[]
): T => {
	return objects.reduce((acc, obj) => {
		for (const key in obj) {
			if (
				Object.hasOwn(obj, key) &&
				(obj as any)[key] !== null &&
				(obj as any)[key] !== undefined
			) {
				(acc as any)[key] = (obj as any)[key];
			}
		}
		return acc;
	}, {} as T);
};

/**
 * Deep clone an object.
 */
export const cloneDeep = <T>(value: T): T => {
	if (value === null || typeof value !== "object") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(cloneDeep) as T;
	}
	const copy = {} as T;
	for (const key in value as any) {
		if (Object.hasOwn(value, key)) {
			(copy as any)[key] = cloneDeep((value as any)[key]);
		}
	}
	return copy;
};

/**
 * A non-null object that is not an array. The prototype is not checked, so
 * class instances pass.
 */
export const isPlainRecord = (
	value: unknown,
): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
