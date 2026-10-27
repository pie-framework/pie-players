import ar from "./element-names/ar.json" with { type: "json" };

/**
 * Element names by primary language subtag, keyed by atomic number. English
 * lives in periodic-table-data.json and is the fallback for every other locale.
 * The Arabic names come from Wikidata and await native review (PIE-1364).
 */
const ELEMENT_NAMES: Record<string, Record<string, string>> = { ar };

/**
 * The element's name in the interface locale. Names follow the interface, like
 * the rest of the tool's text, so `ar-SA` and `ar` read the same set.
 */
export function localizedElementName(
	element: { name: string; number: number },
	locale: string | undefined,
): string {
	const language = (locale ?? "").trim().toLowerCase().split(/[-_]/)[0];
	return ELEMENT_NAMES[language]?.[String(element.number)] ?? element.name;
}
