export function collectElementPackages(sectionData: unknown): string[] {
	const packages = new Set<string>();
	const seen = new WeakSet<object>();

	function walk(value: unknown) {
		if (!value || typeof value !== "object") return;
		if (seen.has(value as object)) return;
		seen.add(value as object);

		const valueAny = value as any;
		const elements = valueAny?.config?.elements;
		if (elements && typeof elements === "object") {
			for (const pkg of Object.values(elements)) {
				if (typeof pkg === "string" && pkg.length > 0) packages.add(pkg);
			}
		}

		if (Array.isArray(valueAny)) {
			for (const entry of valueAny) walk(entry);
			return;
		}

		for (const nested of Object.values(valueAny)) {
			walk(nested);
		}
	}

	walk(sectionData);
	return [...packages].sort();
}

export async function fetchBundleWithRetry(bundleUrl: string): Promise<Response> {
	let attempt = 0;
	const maxAttempts = 12;
	while (attempt < maxAttempts) {
		attempt += 1;
		const response = await fetch(bundleUrl);
		if (response.ok) return response;
		if (response.status === 503) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			continue;
		}
		throw new Error(`Bundle preload failed: ${response.status}`);
	}
	throw new Error("Bundle preload timed out after retries");
}
