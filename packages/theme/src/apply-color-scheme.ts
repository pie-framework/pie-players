const DEFAULT_COLOR_SCHEME_STORAGE_KEY = "pie-color-scheme";

/**
 * Find the nearest `<pie-theme>` that owns `from`'s scheme, walking out
 * across shadow-root boundaries. `Element.closest()` alone stops at a
 * shadow root: a caller mounted inside its own `shadow: "open"` root would
 * never find a `<pie-theme>` ancestor that lives in the light DOM outside
 * it, so this repeats the search from each shadow root's host until it
 * either finds one or reaches the document.
 *
 * Falls back to a document-scoped `<pie-theme>` anywhere in the page, then
 * any `<pie-theme>` at all, matching how a page with exactly one theme host
 * is normally set up.
 */
export function resolvePieThemeHost(from?: Node | null): HTMLElement | null {
	if (typeof document === "undefined") return null;
	let current: Element | null = from instanceof Element ? from : null;
	while (current) {
		const found = current.closest("pie-theme");
		if (found) return found as HTMLElement;
		const root = current.getRootNode();
		current = root instanceof ShadowRoot ? root.host : null;
	}
	return (
		(document.querySelector('pie-theme[scope="document"]') as HTMLElement | null) ||
		(document.querySelector("pie-theme") as HTMLElement | null)
	);
}

export interface ApplyPieColorSchemeOptions {
	/** Search from this node outward for the nearest `<pie-theme>` ancestor. */
	from?: Node | null;
	/** localStorage key to persist the requested scheme under. Pass `null` to skip persistence. */
	persistenceKey?: string | null;
}

/**
 * Apply a requested color scheme and persist it, the one canonical way —
 * shared by every caller that offers scheme selection outside `<pie-theme>`
 * itself (a picker tool, a demo host's own theme controls).
 */
export function applyPieColorScheme(
	schemeId: string,
	options: ApplyPieColorSchemeOptions = {},
): void {
	if (typeof document === "undefined") return;
	const nextScheme = (schemeId || "default").trim() || "default";
	const themeHost = resolvePieThemeHost(options.from);
	if (themeHost) {
		if (themeHost.getAttribute("scheme") !== nextScheme) {
			themeHost.setAttribute("scheme", nextScheme);
		}
	} else {
		// No <pie-theme> owns `data-color-scheme` on this document, so this is
		// the only way the shared color-scheme CSS can still pick up the
		// requested scheme. A scope="document" <pie-theme> that mounts later
		// captures whatever is already on `documentElement` as its restore
		// baseline rather than silently discarding this write.
		const root = document.documentElement;
		if (nextScheme === "default") root.removeAttribute("data-color-scheme");
		else root.setAttribute("data-color-scheme", nextScheme);
	}

	if (options.persistenceKey === null) return;
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem(
			options.persistenceKey ?? DEFAULT_COLOR_SCHEME_STORAGE_KEY,
			nextScheme,
		);
	} catch {
		// Storage may be unavailable (privacy mode, quota); the scheme still applies this session.
	}
}
