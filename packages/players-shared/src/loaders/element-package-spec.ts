/**
 * Shape check for the package specs an item config names in `elements`.
 *
 * Loaders that build CDN URLs from a spec run it through
 * `isScopedPackageSpec` first: item configs are authored content, and a
 * version such as `1.0.0/../../../gh/owner/repo@main` would otherwise
 * resolve to a path outside the package.
 */

const SEMVER_VERSION =
	/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const DIST_TAG = /^[A-Za-z][A-Za-z0-9_-]*$/;
const SCOPED_PACKAGE_NAME =
	/^@[a-z0-9~-][a-z0-9._~-]*\/[a-z0-9~-][a-z0-9._~-]*$/;

/**
 * A scoped npm package name with an optional semver version or dist-tag, as
 * item configs store it: `@pie-element/rubric`, `@pie-element/rubric@latest`,
 * `@pie-element/rubric@8.0.0-hotfix.2`.
 */
export function isScopedPackageSpec(spec: unknown): spec is string {
	if (typeof spec !== "string") return false;
	const versionAt = spec.indexOf("@", 1);
	if (versionAt === -1) return SCOPED_PACKAGE_NAME.test(spec);
	const version = spec.slice(versionAt + 1);
	return (
		SCOPED_PACKAGE_NAME.test(spec.slice(0, versionAt)) &&
		(SEMVER_VERSION.test(version) || DIST_TAG.test(version))
	);
}

/** Why a loader refused `spec`, for its failure reason. */
export function invalidPackageSpecMessage(spec: unknown): string {
	return `Invalid element package spec ${JSON.stringify(String(spec))}: expected a scoped npm package name with an optional semver version or dist-tag`;
}
