import {
	ensureItemPlayerMathRenderingReady,
	type PreloadedController,
	type PreloadedElement,
	registerPreloadedElements,
} from "@pie-players/pie-item-player/preloaded";
import { DEFAULT_IIFE_BUNDLE_RETRY_CONFIG } from "@pie-players/pie-players-shared/loader-config";
import {
	encodeElementPackageSpecs,
	parsePackageName,
} from "@pie-players/pie-players-shared/pie";
import semver from "semver";

/**
 * Registration of the demo content's elements for `strategy="preloaded"`.
 *
 * The demos author legacy `@pie-element/*` versions, which ship as IIFE bundles
 * only, so a demo stands in for a host bundler: it loads one PITS
 * `client-player.js` bundle for the elements the page has not registered yet
 * and registers each element with its controller, because the demo players
 * are not hosted.
 */

const DEFAULT_BUNDLE_HOST = "https://proxy.pie-api.com/bundles/";
const NPM_REGISTRY = "https://registry.npmjs.org";

type ElementMap = Readonly<Record<string, string>>;
type BundledPackage = {
	Element: PreloadedElement["element"];
	controller?: PreloadedController;
};
type PieBundleWindow = Window & {
	pie?: { default?: Record<string, BundledPackage | undefined> };
	PIE_PRELOADED_ELEMENTS?: Record<string, string>;
};

const bundledPackages = new Map<string, Promise<BundledPackage>>();

export type PreloadDemoElementsOptions = {
	/** The PITS bundle host; defaults to the production proxy. */
	bundleHost?: string;
};

/**
 * Register every element the maps (tag to package spec) name.
 *
 * A page registers one version per package, and the players align every
 * authored version to it: a package the page already registered keeps its
 * version, and one the content authors at several versions registers the
 * newest. A dist-tag such as `latest` resolves to its version on npm.
 */
export async function preloadDemoElements(
	elementMaps: readonly ElementMap[],
	options: PreloadDemoElementsOptions = {},
): Promise<void> {
	const host = window as PieBundleWindow;
	const entries = elementMaps.flatMap((elements) => Object.entries(elements));
	if (entries.length === 0) {
		throw new Error("No element packages were found to preload");
	}

	const versions = await resolvePackageVersions(
		entries.map(([, spec]) => spec),
		host.PIE_PRELOADED_ELEMENTS ?? {},
	);
	const packages = await loadPackages(
		[...versions].map(([name, version]) => `${name}@${version}`),
		options.bundleHost ?? DEFAULT_BUNDLE_HOST,
	);

	registerPreloadedElements(
		entries.map(([tag, spec]) => {
			const { name } = parsePackageName(spec);
			const { Element, controller } = packages.get(name) as BundledPackage;
			return {
				tag,
				package: name,
				version: versions.get(name) as string,
				element: Element,
				...(controller ? { controller } : {}),
			};
		}),
	);
}

async function resolvePackageVersions(
	specs: readonly string[],
	registered: Readonly<Record<string, string>>,
): Promise<Map<string, string>> {
	const authored = new Map<string, Set<string>>();
	for (const spec of specs) {
		const { name, version } = parsePackageName(spec);
		authored.set(name, (authored.get(name) ?? new Set()).add(version || "latest"));
	}
	const resolved = await Promise.all(
		[...authored].map(async ([name, wanted]): Promise<[string, string]> => {
			const registeredSpec = registered[name];
			if (registeredSpec) return [name, parsePackageName(registeredSpec).version];
			const exact = await Promise.all(
				[...wanted].map((version) =>
					isExactVersion(version) ? version : npmVersion(name, version),
				),
			);
			return [name, semver.rsort(exact)[0] as string];
		}),
	);
	return new Map(resolved);
}

/** Exact semver without build metadata, which PITS routes cannot carry. */
function isExactVersion(version: string): boolean {
	return semver.valid(version) === version && !version.includes("+");
}

async function npmVersion(name: string, distTag: string): Promise<string> {
	const response = await fetch(`${NPM_REGISTRY}/${name}/${distTag}`);
	if (!response.ok) {
		throw new Error(`npm has no ${name}@${distTag} (HTTP ${response.status})`);
	}
	const { version } = (await response.json()) as { version?: string };
	if (!version) throw new Error(`npm returned no version for ${name}@${distTag}`);
	return version;
}

/** The bundled packages by name; specs loaded earlier on the page come from the cache. */
async function loadPackages(
	specs: readonly string[],
	bundleHost: string,
): Promise<Map<string, BundledPackage>> {
	const missing = specs.filter((spec) => !bundledPackages.has(spec));
	if (missing.length > 0) {
		const bundle = loadBundle(missing, bundleHost);
		for (const spec of missing) {
			const { name } = parsePackageName(spec);
			bundledPackages.set(
				spec,
				bundle.then((pie) => {
					const bundled = pie[name];
					if (!bundled?.Element) {
						throw new Error(`The PITS bundle for ${spec} defines no element`);
					}
					return bundled;
				}),
			);
		}
		bundle.catch(() => {
			// A later call retries a bundle that failed.
			for (const spec of missing) bundledPackages.delete(spec);
		});
	}
	return new Map(
		await Promise.all(
			specs.map(
				async (spec): Promise<[string, BundledPackage]> => [
					parsePackageName(spec).name,
					await (bundledPackages.get(spec) as Promise<BundledPackage>),
				],
			),
		),
	);
}

async function loadBundle(
	specs: readonly string[],
	bundleHost: string,
): Promise<Record<string, BundledPackage | undefined>> {
	const base = bundleHost.endsWith("/") ? bundleHost : `${bundleHost}/`;
	const url = `${base}${encodeElementPackageSpecs([...specs].sort())}/client-player.js`;
	const [source] = await Promise.all([
		fetchBundle(url),
		// The bundles read the math renderer while they evaluate.
		ensureItemPlayerMathRenderingReady(),
	]);
	const script = document.createElement("script");
	script.text = source;
	document.head.appendChild(script);
	script.remove();
	// Each bundle replaces `window.pie`, so its packages are read right away.
	const pie = (window as PieBundleWindow).pie?.default;
	if (!pie) throw new Error(`${url} did not evaluate to a PIE bundle`);
	return pie;
}

/** PITS answers 503 while it builds a bundle, so a 503 is retried as the players retry it. */
async function fetchBundle(url: string): Promise<string> {
	const { retryDelayMs, timeoutMs } = DEFAULT_IIFE_BUNDLE_RETRY_CONFIG;
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const response = await fetch(url);
		if (response.ok) return response.text();
		if (response.status !== 503 || Date.now() >= deadline) {
			throw new Error(`${url} failed with HTTP ${response.status}`);
		}
		await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
	}
}
