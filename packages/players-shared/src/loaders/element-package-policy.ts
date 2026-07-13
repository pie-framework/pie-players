import { valid as validSemver } from "semver";

import { parsePackageName } from "../pie/utils.js";
import type { ElementMap } from "./ElementLoader.js";

/** Optional host policy for executable packages named by `config.elements`. */
export type ElementPackagePolicy = {
	/** Exact package names, or exact `name@version` specs, that may execute. */
	allowedPackages: readonly string[];
	/** Require exact semver without build metadata. Defaults to true. */
	requireExactVersions?: boolean;
};

export class ElementPackagePolicyError extends Error {
	override readonly name = "ElementPackagePolicyError";

	constructor(
		readonly tagName: string,
		readonly packageSpec: string,
		message: string,
	) {
		super(message);
	}
}

function isExactSemver(version: string): boolean {
	return validSemver(version) === version;
}

function parsePolicyPackageSpec(spec: string): {
	packageName: string;
	packagePath: string;
	version: string;
} {
	const parsed = parsePackageName(spec);
	return {
		packageName: parsed.name,
		packagePath: parsed.path ? `${parsed.name}/${parsed.path}` : parsed.name,
		version: parsed.version,
	};
}

/**
 * Validate an element map only when a host explicitly supplies a policy.
 * Omitting the policy preserves the existing trusted-application behavior.
 */
export function assertElementPackagesAllowed(
	elements: ElementMap,
	policy?: ElementPackagePolicy,
): void {
	if (!policy) return;
	const allowed = policy.allowedPackages
		.filter((entry): entry is string => typeof entry === "string")
		.map((entry) => entry.trim())
		.filter(Boolean);

	for (const [tagName, rawSpec] of Object.entries(elements)) {
		const packageSpec = String(rawSpec).trim();
		let parsed: ReturnType<typeof parsePolicyPackageSpec>;
		try {
			parsed = parsePolicyPackageSpec(packageSpec);
		} catch {
			throw new ElementPackagePolicyError(
				tagName,
				packageSpec,
				`Element package policy rejected invalid package spec "${packageSpec}" for ${tagName}.`,
			);
		}

		if (
			(policy.requireExactVersions ?? true) &&
			!isExactSemver(parsed.version)
		) {
			const restriction = parsed.version.includes("+")
				? "does not allow semver build metadata because legacy IIFE bundle routes use + as a package separator"
				: "requires an exact version";
			throw new ElementPackagePolicyError(
				tagName,
				packageSpec,
				`Element package policy ${restriction} for ${tagName}; received "${packageSpec}".`,
			);
		}

		const permitted = allowed.some((entry) => {
			if (entry === packageSpec) return true;
			try {
				const allowedSpec = parsePolicyPackageSpec(entry);
				return (
					allowedSpec.version.length === 0 &&
					allowedSpec.packagePath === parsed.packagePath
				);
			} catch {
				return false;
			}
		});

		if (!permitted) {
			throw new ElementPackagePolicyError(
				tagName,
				packageSpec,
				`Element package policy does not allow "${packageSpec}" for ${tagName}.`,
			);
		}
	}
}
