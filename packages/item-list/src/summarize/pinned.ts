import type { SummarizeFn } from "@pie-element/shared-types";
import type { EsmCdnProviderOption } from "@pie-players/pie-players-shared/loaders";
import type { SummaryResolver } from "./summarize-item.js";

/** The ESM CDN fields of the item player's `loaderOptions`, so a host passes the same object. */
export interface PinnedSummariesOptions {
	/** Default jsDelivr. */
	esmCdnUrl?: string;
	/** Inferred from `esmCdnUrl` when absent. */
	esmCdnProvider?: EsmCdnProviderOption;
}

/** Summarizer modules by URL, page-wide, so each pinned version loads once. */
const pinned = new Map<string, Promise<SummarizeFn | null>>();

// Loaded on first use: the loader helpers carry semver, which `./summarize` would otherwise ship to
// every host that never pins.
let cdn: Promise<typeof import("./cdn.js")> | undefined;

/**
 * Each element's own `./browser/summary` module at the version the item pins, from the CDN the
 * elements load from. A version without one, or a spec naming no scoped package, takes the prompt
 * rung.
 */
export function pinnedSummaries(loaderOptions: PinnedSummariesOptions = {}): SummaryResolver {
	return async (_tagName, pkg) => {
		cdn ??= import("./cdn.js").catch((error: unknown) => {
			cdn = undefined;
			throw error;
		});
		const { isScopedPackageSpec, resolveEsmPackageFileUrl } = await cdn;
		if (!isScopedPackageSpec(pkg)) return null;
		const url = resolveEsmPackageFileUrl(loaderOptions, `${pkg}/dist/browser/summary/index.js`);
		let summarize = pinned.get(url);
		if (!summarize) {
			summarize = import(/* @vite-ignore */ url).then(
				(module: { summarize?: unknown }) =>
					typeof module.summarize === "function" ? (module.summarize as SummarizeFn) : null,
				() => null,
			);
			pinned.set(url, summarize);
		}
		return summarize;
	};
}
