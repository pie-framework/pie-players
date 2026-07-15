import { parsePackageName } from "./utils.js";

const VERSION_DELIMITER = "--version-";
const TAG_VERSION_PATTERN = "[0-9A-Za-z-]+";

const encodeVersionForTag = (version: string): string =>
	version
		.trim()
		.replace(/[.+]/g, "-")
		.replace(/[^0-9A-Za-z-]/g, "-")
		.replace(/-{2,}/g, "-");

export function parseVersionedTagName(tagName: string): {
	baseName: string;
	existingEncodedVersion?: string;
} {
	const versionMatch = tagName.match(
		new RegExp(`${VERSION_DELIMITER}(${TAG_VERSION_PATTERN})$`),
	);
	if (!versionMatch || versionMatch.index === undefined) {
		return { baseName: tagName };
	}
	return {
		baseName: tagName.slice(0, versionMatch.index),
		existingEncodedVersion: versionMatch[1],
	};
}

/**
 * Return the full runtime tag for an element package spec.
 *
 * The version suffix acts as an effective namespace in the immutable browser
 * CustomElementRegistry, allowing several package versions to coexist. Existing
 * versioned inputs are normalized on the runtime copy when a host substitutes a
 * different package version. The caller's authored config is not mutated.
 */
export function toPackageVersionedTag(
	tagName: string,
	packageSpec: string,
	options: { preserveUnversionedTag?: boolean } = {},
): string {
	const { version } = parsePackageName(packageSpec);

	if (!version.trim() && options.preserveUnversionedTag) {
		// aggregateElements historically kept unversioned package specs on their
		// authored tag. Preserve that caller-specific behavior.
		return tagName;
	}

	const targetEncodedVersion = encodeVersionForTag(version);
	const { baseName, existingEncodedVersion } = parseVersionedTagName(tagName);
	if (existingEncodedVersion === targetEncodedVersion) {
		return tagName;
	}

	// pie-item contract compatibility: preloaded hosts have historically replaced
	// package versions at runtime, which requires updating the cloned runtime tag.
	return `${baseName}${VERSION_DELIMITER}${targetEncodedVersion}`;
}
