/**
 * URL-mutation helpers for the `pie-overrides[...]` query-param family used
 * by the section-demos element version toolbar.
 *
 * The param shape and normalization rules match the canonical parser in
 * `@pie-players/pie-players-shared/pie` (`parseElementOverridesFromUrl`).
 */

export function normalizeOverrideVersion(version: string): string {
	const trimmed = String(version ?? "").trim();
	if (!trimmed) return "";
	return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

function normalizePackageKey(packageName: string): string {
	return packageName.startsWith("@") ? packageName.slice(1) : packageName;
}

/**
 * Return a new `URLSearchParams` with `pie-overrides[...]` entries removed.
 * When `packageName` is provided only that one override key is removed;
 * otherwise every `pie-overrides[*]` key is stripped.
 */
export function removeOverrideParams(
	params: URLSearchParams,
	packageName?: string,
): URLSearchParams {
	const next = new URLSearchParams(params);
	if (!packageName) {
		const overrideKeys = [...next.keys()].filter(
			(key) => key.startsWith("pie-overrides[") && key.endsWith("]"),
		);
		for (const key of overrideKeys) {
			next.delete(key);
		}
		return next;
	}
	next.delete(`pie-overrides[${normalizePackageKey(packageName)}]`);
	return next;
}

/**
 * Build a URL target for setting or clearing a single override. Pass `null`
 * as the version to clear the override, or a version string to set it.
 *
 * Matches the item-demos layout semantics: changing an override forces a full
 * document reload via the caller (`window.location.assign`) to drop any
 * in-memory player state tied to the previous version.
 */
export function buildOverrideUrl(
	currentUrl: URL,
	packageName: string,
	version: string | null,
): string {
	const nextParams = new URLSearchParams(currentUrl.searchParams);
	const paramKey = `pie-overrides[${normalizePackageKey(packageName)}]`;
	if (!version) {
		nextParams.delete(paramKey);
	} else {
		nextParams.set(paramKey, normalizeOverrideVersion(version));
	}
	const query = nextParams.toString();
	return query ? `${currentUrl.pathname}?${query}` : currentUrl.pathname;
}
