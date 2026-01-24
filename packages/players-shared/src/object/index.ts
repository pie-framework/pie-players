/**
 * A problem using the spread operator merging objects is that undefined properties may override
 * defined properties, which is often NOT what you want (e.g. when providing default values). This
 * function merges objects, but ignores properties that are null or undefined.
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
		// Primitive value (or null), just return it
		return value;
	}
	if (Array.isArray(value)) {
		// Array: clone each element recursively
		return value.map(cloneDeep) as T;
	}
	// Object: create a new object and clone its properties
	const copy = {} as T;
	for (const key in value as any) {
		if (Object.hasOwn(value, key)) {
			(copy as any)[key] = cloneDeep((value as any)[key]);
		}
	}
	return copy;
};
