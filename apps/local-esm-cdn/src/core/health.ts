import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./utils.js";

/**
 * Health check status
 */
export type Health = {
	ok: boolean;
	pieElementsNgPath: string;
	elementsReactPath: string;
	elementsSveltePath: string;
	libReactPath: string;
	libSveltePath: string;
	sharedPath: string;
	builtElementPackages: number;
	builtLibPackages: number;
	builtSharedPackages: number;
	sampleElement?: string;
	sampleLib?: string;
	sampleShared?: string;
};

/**
 * Find any built packages in a directory
 * @param packagesDir - Directory to search for packages
 * @param max - Maximum number of packages to check
 * @returns Count of built packages and a sample package name
 */
export async function findAnyBuiltPackages(
	packagesDir: string,
	max = 200,
): Promise<{ count: number; sample?: string }> {
	let count = 0;
	let sample: string | undefined;

	let entries: string[];
	try {
		entries = await readdir(packagesDir);
	} catch {
		return { count: 0 };
	}

	for (const pkgName of entries.slice(0, max)) {
		const candidate = path.join(packagesDir, pkgName, "dist", "index.js");
		if (await fileExists(candidate)) {
			count++;
			if (!sample) sample = pkgName;
		}
	}
	return { count, sample };
}

/**
 * Cached health check result
 */
let cachedHealth: {
	at: number;
	pieElementsNgPath: string;
	value: Health;
} | null = null;

/**
 * Get the health status of the local ESM CDN
 * @param pieElementsNgPath - Root path to the pie-elements-ng repository
 * @returns Health status
 */
export async function getHealth(pieElementsNgPath: string): Promise<Health> {
	const now = Date.now();
	if (
		cachedHealth &&
		cachedHealth.pieElementsNgPath === pieElementsNgPath &&
		now - cachedHealth.at < 1500
	) {
		return cachedHealth.value;
	}

	const elementsReactPath = path.join(
		pieElementsNgPath,
		"packages",
		"elements-react",
	);
	const elementsSveltePath = path.join(
		pieElementsNgPath,
		"packages",
		"elements-svelte",
	);
	const libReactPath = path.join(pieElementsNgPath, "packages", "lib-react");
	const libSveltePath = path.join(pieElementsNgPath, "packages", "lib-svelte");
	const sharedPath = path.join(pieElementsNgPath, "packages", "shared");

	const elementsReact = await findAnyBuiltPackages(elementsReactPath);
	const elementsSvelte = await findAnyBuiltPackages(elementsSveltePath);
	const libsReact = await findAnyBuiltPackages(libReactPath);
	const libsSvelte = await findAnyBuiltPackages(libSveltePath);
	const shared = await findAnyBuiltPackages(sharedPath);
	const builtElementPackages = elementsReact.count + elementsSvelte.count;
	const builtLibPackages = libsReact.count + libsSvelte.count;

	const ok =
		existsSync(pieElementsNgPath) &&
		((existsSync(elementsReactPath) && elementsReact.count > 0) ||
			(existsSync(elementsSveltePath) && elementsSvelte.count > 0) ||
			(existsSync(libReactPath) && libsReact.count > 0) ||
			(existsSync(libSveltePath) && libsSvelte.count > 0) ||
			(existsSync(sharedPath) && shared.count > 0));

	const value: Health = {
		ok,
		pieElementsNgPath,
		elementsReactPath,
		elementsSveltePath,
		libReactPath,
		libSveltePath,
		sharedPath,
		builtElementPackages,
		builtLibPackages,
		builtSharedPackages: shared.count,
		sampleElement: elementsReact.sample ?? elementsSvelte.sample,
		sampleLib: libsReact.sample ?? libsSvelte.sample,
		sampleShared: shared.sample,
	};

	cachedHealth = { at: now, pieElementsNgPath, value };
	return value;
}
