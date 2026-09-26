type DemoPlayerConfig = {
	loaderOptions?: Record<string, unknown>;
	[key: string]: unknown;
};

/**
 * The demo pages' `runtime.player` config. Under `dev:section:cdn` this dev
 * server also serves pie-elements-ng (`LOCAL_ESM_CDN`), so ESM element loads go
 * to its origin in place of jsDelivr.
 */
export function withDemoLoaderOptions<T extends DemoPlayerConfig>(config: T): T {
	if (
		import.meta.env.VITE_LOCAL_ESM_CDN !== "true" ||
		typeof window === "undefined"
	) {
		return config;
	}
	return {
		...config,
		loaderOptions: {
			...config.loaderOptions,
			esmCdnUrl: window.location.origin,
		},
	};
}
