export function coerceBooleanLike(
	value: boolean | string | null | undefined,
	defaultValue = false,
): boolean {
	if (typeof value === "boolean") {
		return value;
	}
	if (value === null || value === undefined) {
		return defaultValue;
	}
	const normalizedValue = String(value).trim().toLowerCase();
	if (normalizedValue === "") {
		return defaultValue;
	}
	if (["false", "0", "off", "no"].includes(normalizedValue)) {
		return false;
	}
	if (["true", "1", "on", "yes"].includes(normalizedValue)) {
		return true;
	}
	return Boolean(normalizedValue);
}
