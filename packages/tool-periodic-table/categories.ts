/**
 * Canonical category id for a data category. The ids drive the
 * `__category--*` classes and filtering; display goes through the catalog.
 */
export function normalizeCategory(category: string): string {
	const lower = category.toLowerCase();
	if (lower.indexOf("unknown") !== -1) {
		return "Unknown";
	}
	// Map common category names to standard format
	const mappings: Record<string, string> = {
		"alkali metal": "Alkali Metal",
		"alkaline earth": "Alkaline Earth Metal",
		"alkaline earth metal": "Alkaline Earth Metal",
		"transition metal": "Transition Metal",
		"post-transition metal": "Post-transition Metal",
		metalloid: "Metalloid",
		nonmetal: "Diatomic Nonmetal",
		"polyatomic nonmetal": "Polyatomic Nonmetal",
		"diatomic nonmetal": "Diatomic Nonmetal",
		halogen: "Diatomic Nonmetal", // Halogens are diatomic nonmetals
		"noble gas": "Noble Gas",
		lanthanide: "Lanthanide",
		actinide: "Actinide",
		metal: "Post-transition Metal", // Some elements might just be 'metal'
	};
	return mappings[lower] || category;
}

/** Suffix of the `__category--*` class for a normalized category. */
export function categorySlug(category: string): string {
	return category.trim().toLowerCase().replace(/\s+/g, "-");
}
