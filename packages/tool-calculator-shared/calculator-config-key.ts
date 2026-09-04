/**
 * Produce a stable semantic key for JSON-like provider configuration.
 * Object keys are sorted recursively so equivalent config objects do not
 * remount an expensive calculator solely because their identity changed.
 */
export function createCalculatorConfigKey(value: unknown): string {
	const ancestors = new Set<object>();

	const normalize = (current: unknown): unknown => {
		if (current === undefined) return { $type: "undefined" };
		if (typeof current === "bigint") {
			return { $type: "bigint", value: current.toString() };
		}
		if (typeof current === "function") {
			return { $type: "function", value: current.toString() };
		}
		if (typeof current === "symbol") {
			return { $type: "symbol", value: current.description ?? "" };
		}
		if (current === null || typeof current !== "object") return current;
		if (ancestors.has(current)) {
			return { $type: "circular-reference" };
		}

		ancestors.add(current);
		const normalized = Array.isArray(current)
			? current.map(normalize)
			: Object.fromEntries(
					Object.entries(current)
						.sort(([left], [right]) => left.localeCompare(right))
						.map(([key, entry]) => [key, normalize(entry)]),
				);
		ancestors.delete(current);
		return normalized;
	};

	return JSON.stringify(normalize(value));
}
