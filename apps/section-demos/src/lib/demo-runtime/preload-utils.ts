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

export function buildBundleKey(packages: string[]): string {
	return [...packages]
		.filter((pkg) => typeof pkg === "string" && pkg.length > 0)
		.sort()
		.join("+");
}

export async function fetchBundleWithRetry(bundleUrl: string): Promise<Response> {
	let attempt = 0;
	const maxAttempts = 12;
	let lastStatus: number | "network" | null = null;
	while (attempt < maxAttempts) {
		attempt += 1;
		try {
			const response = await fetch(bundleUrl);
			if (response.ok) return response;
			lastStatus = response.status;
			if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				continue;
			}
			throw new Error(`Bundle preload failed: ${response.status}`);
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Bundle preload failed:")) {
				throw error;
			}
			lastStatus = "network";
			await new Promise((resolve) => setTimeout(resolve, 1000));
			continue;
		}
	}
	if (lastStatus === "network") {
		throw new Error("Bundle preload failed: network error");
	}
	if (typeof lastStatus === "number") {
		throw new Error(`Bundle preload failed: ${lastStatus}`);
	}
	throw new Error("Bundle preload timed out after retries");
}
