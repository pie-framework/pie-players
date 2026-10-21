import type { SummarizeFn } from "@pie-element/shared-types";
import type {
	ElementPackagePolicy,
	EsmCdnProviderOption,
} from "@pie-players/pie-players-shared/loaders";
import type { SummaryResolver } from "./summarize-item.js";

/** The item player's `loaderOptions` fields that bear on a summarizer load, so a host passes the same object. */
export interface PinnedSummariesOptions {
	/** Default jsDelivr. */
	esmCdnUrl?: string;
	/** Inferred from `esmCdnUrl` when absent. */
	esmCdnProvider?: EsmCdnProviderOption;
	/** A package the policy refuses takes the prompt rung; its summarizer never loads. */
	elementPackagePolicy?: ElementPackagePolicy;
}

/** Summarizer modules by URL, page-wide, so each pinned version loads once. */
const pinned = new Map<string, Promise<SummarizeFn | null>>();
/** Transient failures by URL. Each retry imports a fresh URL, since a browser may keep a failed module. */
const retries = new Map<string, number>();
/** Transient failures after which a URL takes the prompt rung for the page, as a missing module does. */
const MAX_RETRIES = 3;

// Loaded on first use: the loader helpers carry semver, which `./summarize` would otherwise ship to
// every host that never pins.
let cdn: Promise<typeof import("./cdn.js")> | undefined;

/**
 * Each element's own `./browser/summary` module at the version the item pins, from the CDN the
 * elements load from. A version without one, or a spec naming no scoped package, takes the prompt
 * rung, as does one `elementPackagePolicy` refuses. So does a row whose load failed transiently, but
 * the next row to resolve that URL retries.
 */
export function pinnedSummaries(loaderOptions: PinnedSummariesOptions = {}): SummaryResolver {
	return async (tagName, spec) => {
		cdn ??= import("./cdn.js").catch((error: unknown) => {
			cdn = undefined;
			throw error;
		});
		const { assertElementPackagesAllowed, isScopedPackageSpec, resolveEsmPackageFileUrl } = await cdn;
		if (!isScopedPackageSpec(spec)) return null;
		try {
			assertElementPackagesAllowed({ [tagName]: spec }, loaderOptions.elementPackagePolicy);
		} catch {
			return null;
		}
		const url = resolveEsmPackageFileUrl(loaderOptions, `${spec}/dist/browser/summary/index.js`);
		let summarize = pinned.get(url);
		if (!summarize) {
			summarize = load(url);
			pinned.set(url, summarize);
		}
		return summarize;
	};
}

function load(url: string): Promise<SummarizeFn | null> {
	const retry = retries.get(url) ?? 0;
	const target = retry === 0 ? url : `${url}${url.includes("?") ? "&" : "?"}retry=${retry}`;
	return import(/* @vite-ignore */ target).then(
		(module: { summarize?: unknown }) =>
			typeof module.summarize === "function" ? (module.summarize as SummarizeFn) : null,
		async () => {
			if (retry < MAX_RETRIES && (await isTransient(target))) {
				pinned.delete(url);
				retries.set(url, retry + 1);
			}
			return null;
		},
	);
}

/** Whether a failed import may succeed later: the CDN was unreachable, or answered 408, 429 or 5xx. */
async function isTransient(url: string): Promise<boolean> {
	try {
		const { status } = await fetch(url, { method: "HEAD" });
		return status === 408 || status === 429 || status >= 500;
	} catch {
		return true;
	}
}
