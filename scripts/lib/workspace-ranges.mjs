/**
 * How a `workspace:` dependency specifier becomes a range a consumer can install.
 *
 * Extracted so the two publish paths cannot disagree. changeset-publish-resolved-workspaces.mjs
 * rewrites every manifest for a normal release; bootstrap-package.mjs rewrites one manifest for
 * a package's first publish. Both put the result on the registry permanently, and a divergence
 * between them would show up as one package pinning its siblings differently from all the
 * others — visible only to whoever tried to install it.
 */

/**
 * Resolve one `workspace:`-prefixed specifier against the version the workspace holds.
 *
 * Returns the specifier untouched when the package is not a workspace member, which leaves an
 * unresolvable `workspace:` range in the manifest rather than inventing a version. Callers
 * check for that: publishing it would produce a package no consumer can install.
 */
export function resolveWorkspaceRange(workspaceSpecifier, localVersion) {
	if (!localVersion) return workspaceSpecifier;

	const suffix = workspaceSpecifier.slice("workspace:".length);
	if (suffix === "*" || suffix === "") return localVersion;
	if (suffix === "^") return `^${localVersion}`;
	if (suffix === "~") return `~${localVersion}`;
	return suffix;
}

/** Dependency sections that may carry a `workspace:` range. */
export const DEP_SECTIONS = [
	"dependencies",
	"peerDependencies",
	"optionalDependencies",
	"devDependencies",
];

/**
 * Rewrite every `workspace:` range in `manifest` in place, reporting what changed.
 *
 * `versions` maps package name to the version the workspace holds. Pure and manifest-shaped so
 * the resolution can be asserted without a checkout: the caller owns reading and writing files.
 */
export function resolveManifestWorkspaceRanges(manifest, versions) {
	const resolved = [];
	const unresolved = [];

	for (const section of DEP_SECTIONS) {
		const deps = manifest[section];
		if (!deps) continue;
		for (const [name, range] of Object.entries(deps)) {
			if (typeof range !== "string" || !range.startsWith("workspace:"))
				continue;
			const next = resolveWorkspaceRange(range, versions.get(name));
			if (next === range) {
				unresolved.push({ section, name, range });
				continue;
			}
			deps[name] = next;
			resolved.push({ section, name, from: range, to: next });
		}
	}

	return { resolved, unresolved };
}
