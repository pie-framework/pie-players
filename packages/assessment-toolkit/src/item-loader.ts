import type { ItemEntity } from "@pie-framework/pie-players-shared";

export type LoadItemOptions = {
	organizationId?: string | null;
};

export type LoadItem = (
	itemVId: string,
	opts?: LoadItemOptions,
) => Promise<ItemEntity>;

export class ItemLoadError extends Error {
	readonly code:
		| "ITEM_NOT_FOUND"
		| "NO_ITEM_BANK_OR_FETCH_CONFIG"
		| "FETCH_NOT_AVAILABLE"
		| "FETCH_FAILED";

	constructor(code: ItemLoadError["code"], message: string) {
		super(message);
		this.name = "ItemLoadError";
		this.code = code;
	}
}

export type CreateLoadItemOptions = {
	/**
	 * Optional in-memory item bank. Keys are itemVId.
	 * This enables a no-backend default for demos/tests.
	 */
	itemBank?: Record<string, ItemEntity>;

	/**
	 * Optional base URL for an item API. If set, `createLoadItem` will fetch when
	 * an item is not present in `itemBank`.
	 *
	 * Example: `https://host.example.com`
	 */
	fetchBaseUrl?: string;

	/**
	 * Optional endpoint builder.
	 * Defaults to `/api/item/:itemVId` (and appends `?organizationId=...` if provided).
	 */
	itemEndpoint?: string | ((itemVId: string, opts?: LoadItemOptions) => string);

	/**
	 * Custom fetch implementation (useful for tests or hosts).
	 * Defaults to `globalThis.fetch`.
	 */
	fetchImpl?: typeof fetch;
};

function defaultItemEndpoint(itemVId: string, opts?: LoadItemOptions) {
	const url = new URL(`/api/item/${itemVId}`, "https://placeholder.invalid");
	if (opts?.organizationId)
		url.searchParams.set("organizationId", opts.organizationId);
	return url.pathname + url.search;
}

export function createFetchItemLoader(opts: {
	baseUrl: string;
	itemEndpoint?: CreateLoadItemOptions["itemEndpoint"];
	fetchImpl?: typeof fetch;
}): LoadItem {
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	if (!fetchImpl) {
		throw new ItemLoadError(
			"FETCH_NOT_AVAILABLE",
			"globalThis.fetch is not available in this environment",
		);
	}

	return async (itemVId, loadOpts) => {
		const endpointBuilder =
			typeof opts.itemEndpoint === "function"
				? opts.itemEndpoint
				: typeof opts.itemEndpoint === "string"
					? () => opts.itemEndpoint as string
					: defaultItemEndpoint;

		const endpoint = endpointBuilder(itemVId, loadOpts);
		const url = new URL(endpoint, opts.baseUrl);

		const res = await fetchImpl(url.toString());
		if (!res.ok) {
			throw new ItemLoadError(
				"FETCH_FAILED",
				`Failed to load item ${itemVId}: ${res.status} ${res.statusText}`,
			);
		}
		return (await res.json()) as ItemEntity;
	};
}

/**
 * Client-resolvable default loader:
 * - resolve from `itemBank` first (no backend required)
 * - optionally fallback to fetch (encouraged backend hook)
 */
export function createLoadItem(opts: CreateLoadItemOptions): LoadItem {
	const itemBank = opts.itemBank;
	const fetchBaseUrl = opts.fetchBaseUrl;

	const fetchImpl =
		opts.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
	const fetchLoader =
		fetchBaseUrl && typeof fetchImpl === "function"
			? createFetchItemLoader({
					baseUrl: fetchBaseUrl,
					itemEndpoint: opts.itemEndpoint,
					fetchImpl,
				})
			: null;

	return async (itemVId, loadOpts) => {
		if (itemBank?.[itemVId]) return itemBank[itemVId];

		if (fetchLoader) return await fetchLoader(itemVId, loadOpts);

		if (fetchBaseUrl && typeof fetchImpl !== "function") {
			throw new ItemLoadError(
				"FETCH_NOT_AVAILABLE",
				"fetchBaseUrl was provided but globalThis.fetch is not available",
			);
		}

		throw new ItemLoadError(
			"NO_ITEM_BANK_OR_FETCH_CONFIG",
			"No itemBank entry and no fetchBaseUrl configured for item loading",
		);
	};
}
