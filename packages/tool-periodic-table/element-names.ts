/** Element names keyed by atomic number. */
export type ElementNames = Record<string, string>;

type ElementNamesLoader = () => Promise<{ default: ElementNames }>;

/**
 * Element names by primary language subtag. English lives in
 * periodic-table-data.json and is the fallback for every other locale.
 *
 * An explicit static map of `import()` calls, like the interface catalogs in
 * `@pie-players/pie-i18n-generated`, so each language is its own chunk and a
 * table opened in English never fetches one. The Arabic names come from
 * Wikidata and await native review (PIE-1364).
 */
const ELEMENT_NAME_LOADERS: Record<string, ElementNamesLoader> = {
	ar: () => import("./element-names/ar.json", { with: { type: "json" } }),
};

const loaded = new Map<string, Promise<ElementNames | undefined>>();

/**
 * The language whose names a locale reads. Names follow the interface, like the
 * rest of the tool's text, so `ar-SA` and `ar` read the same set.
 */
export function elementNamesLanguage(locale: string | undefined): string {
	return (locale ?? "").trim().toLowerCase().split(/[-_]/)[0];
}

/**
 * The names for a language, loaded once. Resolves to `undefined` for a language
 * with no set, and for one whose chunk failed to load, which a later call retries.
 */
export function loadElementNames(
	language: string,
): Promise<ElementNames | undefined> {
	const loader = ELEMENT_NAME_LOADERS[language];
	if (!loader) return Promise.resolve(undefined);

	let names = loaded.get(language);
	if (!names) {
		names = loader().then(
			(module) => module.default,
			() => {
				loaded.delete(language);
				return undefined;
			},
		);
		loaded.set(language, names);
	}
	return names;
}

/** The element's name from a loaded set, or its English name. */
export function localizedElementName(
	element: { name: string; number: number },
	names: ElementNames | undefined,
): string {
	return names?.[String(element.number)] ?? element.name;
}
