/**
 * Key-stable `JSON.stringify` for signature comparison.
 *
 * Object keys are emitted in sorted order so two structurally equal configs or
 * session containers produce the same string regardless of property insertion
 * order, and cycles degrade to `"[Circular]"` instead of throwing. Shared by the
 * component's config/renderer keys and the backend orchestrator's session and
 * model-refresh signatures, which have to agree on what "unchanged" means.
 */
export function stableStringifyForKey(value: unknown): string {
	try {
		const seen = new WeakSet<object>();
		return JSON.stringify(value, (_key, nestedValue) => {
			if (
				!nestedValue ||
				typeof nestedValue !== "object" ||
				Array.isArray(nestedValue)
			) {
				return nestedValue;
			}
			if (seen.has(nestedValue)) {
				return "[Circular]";
			}
			seen.add(nestedValue);
			return Object.keys(nestedValue as Record<string, unknown>)
				.sort()
				.reduce(
					(acc, key) => {
						acc[key] = (nestedValue as Record<string, unknown>)[key];
						return acc;
					},
					{} as Record<string, unknown>,
				);
		});
	} catch {
		return String(value);
	}
}
