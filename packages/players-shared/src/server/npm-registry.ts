import semver from "semver";

const NPM_REGISTRY_URL = "https://registry.npmjs.org";

if (typeof window !== "undefined") {
	throw new Error(
		"[npm-registry] @pie-players/pie-players-shared/server/npm-registry is server-only and cannot be imported in browser code",
	);
}

const DEFAULT_FILTER = (v: string) =>
	v.indexOf("print") === -1 &&
	v.indexOf("ps") === -1 &&
	v.indexOf("strikethrough") === -1 &&
	v.indexOf("alpha") === -1 &&
	v.indexOf("bm") === -1;

type NpmFetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

/**
 * Server-only helper for npm package version lookups.
 * Do not import this module from browser-executed code.
 */
export const getNpmPackageVersions = async (
	element: string,
	fetch: NpmFetch,
	filter: (v: string) => boolean = DEFAULT_FILTER,
	limit?: number,
	searchTerm = "",
): Promise<string[]> => {
	if (typeof window !== "undefined") {
		throw new Error(
			"[npm-registry] server-only module imported in browser context",
		);
	}

	try {
		const response = await fetch(`${NPM_REGISTRY_URL}/${element}`);
		if (!response.ok) {
			console.warn(
				`[npm-registry] npm status ${response.status} for package ${element}`,
			);
			return searchTerm ? [] : ["latest"];
		}

		const json = await response.json();
		const versions = json?.versions as Record<
			string,
			{ deprecated?: string }
		> | null;
		if (!versions || typeof versions !== "object") {
			console.warn(
				`[npm-registry] response for ${element} missing 'versions' property`,
			);
			return searchTerm ? [] : ["latest"];
		}

		let sorted = Object.keys(versions)
			.filter(filter)
			.filter((v) => !versions[v]?.deprecated)
			.filter((v) => !/^11\.0\.\d+-esm\.\d+/.test(v))
			.filter(
				(v) =>
					!searchTerm || v.toLowerCase().includes(searchTerm.toLowerCase()),
			)
			.sort((a, b) => {
				const verA = semver.valid(semver.clean(a));
				const verB = semver.valid(semver.clean(b));
				if (!verA && !verB) return 0;
				if (!verA) return 1;
				if (!verB) return -1;
				return semver.rcompare(verA, verB);
			});

		if (typeof limit === "number" && limit > 0) {
			sorted = sorted.slice(0, limit);
		}

		if (!searchTerm) {
			sorted.unshift("latest");
		}

		return sorted;
	} catch (error) {
		console.warn(
			`[npm-registry] failed package lookup for ${element}:`,
			error,
		);
		return searchTerm ? [] : ["latest"];
	}
};
