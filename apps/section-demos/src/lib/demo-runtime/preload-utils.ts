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

export function collectPieConfigs(sectionData: unknown): Array<Record<string, unknown>> {
	const configs: Array<Record<string, unknown>> = [];
	const seen = new WeakSet<object>();

	function walk(value: unknown) {
		if (!value || typeof value !== "object") return;
		if (seen.has(value as object)) return;
		seen.add(value as object);

		const valueAny = value as Record<string, unknown>;
		const config = valueAny.config;
		if (config && typeof config === "object") {
			const configAny = config as Record<string, unknown>;
			if (configAny.elements && typeof configAny.elements === "object") {
				configs.push(configAny);
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
	return configs;
}

export function buildBundleKey(packages: string[]): string {
	return [...packages]
		.filter((pkg) => typeof pkg === "string" && pkg.length > 0)
		.sort()
		.join("+");
}

export function collectElementTags(sectionData: unknown): string[] {
	const tags = new Set<string>();
	const seen = new WeakSet<object>();

	function walk(value: unknown) {
		if (!value || typeof value !== "object") return;
		if (seen.has(value as object)) return;
		seen.add(value as object);

		const valueAny = value as any;
		const elements = valueAny?.config?.elements;
		if (elements && typeof elements === "object") {
			for (const [tagName, packageSpec] of Object.entries(elements as Record<string, unknown>)) {
				if (typeof tagName !== "string" || tagName.length === 0) continue;
				if (tagName.includes("--version-")) {
					tags.add(tagName);
					continue;
				}
				if (typeof packageSpec !== "string" || packageSpec.length === 0) {
					tags.add(tagName);
					continue;
				}
				const versionToken = packageSpec.split("@").pop();
				if (!versionToken || versionToken.length === 0) {
					tags.add(tagName);
					continue;
				}
				const encodedVersion = versionToken.replace(/[^a-zA-Z0-9]+/g, "-");
				tags.add(`${tagName}--version-${encodedVersion}`);
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
	return [...tags].sort();
}

export async function waitForCustomElements(
	tags: string[],
	options?: { timeoutMs?: number },
): Promise<void> {
	if (typeof window === "undefined" || typeof customElements === "undefined") return;
	const requiredTags = [...new Set(tags.filter((tag) => typeof tag === "string" && tag.length > 0))];
	if (requiredTags.length === 0) return;
	const unresolvedTags = requiredTags.filter((tag) => customElements.get(tag) === undefined);
	if (unresolvedTags.length === 0) return;

	const timeoutMs = options?.timeoutMs ?? 30_000;
	await Promise.race([
		Promise.all(unresolvedTags.map((tag) => customElements.whenDefined(tag))),
		new Promise<never>((_, reject) => {
			window.setTimeout(() => {
				const stillMissing = unresolvedTags.filter((tag) => customElements.get(tag) === undefined);
				reject(
					new Error(
						`Timed out waiting for custom elements: ${stillMissing.join(", ") || unresolvedTags.join(", ")}`,
					),
				);
			}, timeoutMs);
		}),
	]);
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
