/**
 * A player that is not hosted runs each element's `model()` through the
 * controller `window.PIE_REGISTRY` holds for its tag. Under the `preloaded`
 * strategy that controller exists only when the host passed one to
 * `registerPreloadedElements`.
 */

const reportedTags = new Set<string>();

/** The tags among `tags` registered without a controller, each returned once per page. */
export function takeTagsWithoutController(tags: readonly string[]): string[] {
	const registry =
		typeof window === "undefined"
			? undefined
			: (window as { PIE_REGISTRY?: Record<string, { controller?: unknown }> })
					.PIE_REGISTRY;
	const unreported = tags.filter(
		(tag) => !registry?.[tag]?.controller && !reportedTags.has(tag),
	);
	for (const tag of unreported) reportedTags.add(tag);
	return unreported;
}

export function missingControllerWarning(tag: string): string {
	return (
		`${tag} is registered without a controller, so this player, which is not hosted, ` +
		"renders its authored model without running model(). Pass the package's ./browser/controller module " +
		"as controller to registerPreloadedElements, or set hosted when a server processes models."
	);
}
