import { preloadDemoElements } from "@pie-players/demo-ui/preloaded";

/** Every PIE config in the section: its items' and its passages'. */
export function collectPieConfigs(
	sectionData: unknown,
): Array<Record<string, unknown>> {
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

/**
 * Register the section's elements for the `preloaded` player type, then report
 * to `ready` or `failed`. The returned function silences a run a newer one
 * replaced, so an `$effect` returns it as its teardown.
 */
export function preloadSectionElements(
	section: unknown,
	report: { ready: () => void; failed: (error: Error) => void },
): () => void {
	let current = true;
	preloadDemoElements(
		collectPieConfigs(section).map(
			(config) => config.elements as Record<string, string>,
		),
	).then(
		() => {
			if (current) report.ready();
		},
		(error: unknown) => {
			if (current) {
				report.failed(error instanceof Error ? error : new Error(String(error)));
			}
		},
	);
	return () => {
		current = false;
	};
}
