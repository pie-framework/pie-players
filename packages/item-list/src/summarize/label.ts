/** `spec`, an `elements` map value such as `@pie-element/multiple-choice@11.0.0`, without its version. */
export function packageName(spec: string): string {
	const at = spec.indexOf("@", 1);
	return at === -1 ? spec : spec.slice(0, at);
}

/** The display name of `pkg`: `@pie-element/multiple-choice` reads "Multiple choice". */
export function displayName(pkg: string): string {
	const name = pkg.slice(pkg.lastIndexOf("/") + 1).replace(/[-_]+/g, " ").trim();
	return name.charAt(0).toUpperCase() + name.slice(1);
}
