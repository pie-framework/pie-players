import { valid as validSemver } from "semver";

import { parsePackageName } from "../pie/utils.js";
import type { ElementMap } from "./ElementLoader.js";

/** Host policy for executable packages named by `config.elements`. */
export type ElementPackagePolicy = {
	/**
	 * Package names, exact `name@version` specs, or `@scope/*` for every
	 * package in a scope, that may execute. Absent, any package may.
	 */
	allowedPackages?: readonly string[];
	/** Require exact semver without build metadata. Defaults to true. */
	requireExactVersions?: boolean;
};

/**
 * The policy ESM loads apply when the host supplies none: any package, at an
 * exact version. A published version's bytes never change, so the hash a host
 * pins for it stays valid; a tag or range resolves to whatever was published
 * last.
 */
export const DEFAULT_ESM_ELEMENT_PACKAGE_POLICY: ElementPackagePolicy =
	Object.freeze({ requireExactVersions: true });

const SCOPE_WILDCARD = /^(@[a-z0-9][a-z0-9._~-]*)\/\*$/;

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

/** Exact semver: no range, tag, `v` prefix or build metadata. */
export function isExactSemver(version: string): boolean {
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
 * Validate an element map against `policy`; without one, nothing is checked.
 * `ensureRegistered` supplies `DEFAULT_ESM_ELEMENT_PACKAGE_POLICY` for ESM.
 */
export function assertElementPackagesAllowed(
	elements: ElementMap,
	policy?: ElementPackagePolicy,
): void {
	if (!policy) return;
	const allowed = policy.allowedPackages
		?.filter((entry): entry is string => typeof entry === "string")
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

		const permitted = !allowed || allowed.some((entry) => {
			if (entry === packageSpec) return true;
			const scope = SCOPE_WILDCARD.exec(entry)?.[1];
			if (scope) return parsed.packageName.startsWith(`${scope}/`);
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
