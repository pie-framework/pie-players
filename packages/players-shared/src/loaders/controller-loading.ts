/**
 * Whether a player's ESM backend fetches controller modules
 * (`EsmBackendConfig.loadControllers`).
 *
 * The host's `loaderOptions.loadControllers` decides when set. Otherwise an
 * author view loads them, and a delivery loads them unless it is hosted: a
 * hosted player takes models and scores from the server and resolves no
 * controller (`findPieController`), so fetching one is wasted.
 */
export function resolveLoadControllers(args: {
	loadControllers?: boolean;
	author: boolean;
	hosted: boolean;
}): boolean {
	return args.loadControllers ?? (args.author || !args.hosted);
}
