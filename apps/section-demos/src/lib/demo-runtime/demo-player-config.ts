import { getUrlEnumParam } from "./demo-page-helpers";

type DemoPlayerConfig = {
	loaderOptions?: Record<string, unknown>;
	[key: string]: unknown;
};

export const ESM_CDN_QUERY_PARAM = "esmCdn";
export const ESM_CDN_OPTIONS = ["default", "pie-proxy"] as const;

/**
 * The ESM CDNs `?esmCdn=` picks, by name so a link cannot point the page at an
 * arbitrary script origin. `pie-proxy` mounts jsDelivr's files off `/npm`, as a
 * host behind a mirror loads them.
 */
const ESM_CDN_URLS: Record<(typeof ESM_CDN_OPTIONS)[number], string | null> = {
	default: null,
	"pie-proxy": "https://proxy.pie-api.com/esm",
};

/**
 * The demo pages' `runtime.player` config. `?esmCdn=` sets the ESM CDN; under
 * `dev:section:cdn` without it, this dev server also serves pie-elements-ng
 * (`LOCAL_ESM_CDN`), so ESM element loads go to its origin in place of jsDelivr.
 */
export function withDemoLoaderOptions<T extends DemoPlayerConfig>(config: T): T {
	if (typeof window === "undefined") return config;
	const esmCdnUrl =
		ESM_CDN_URLS[getUrlEnumParam(ESM_CDN_QUERY_PARAM, ESM_CDN_OPTIONS, "default")] ??
		(import.meta.env.VITE_LOCAL_ESM_CDN === "true" ? window.location.origin : null);
	if (!esmCdnUrl) return config;
	return {
		...config,
		loaderOptions: {
			...config.loaderOptions,
			esmCdnUrl,
		},
	};
}
