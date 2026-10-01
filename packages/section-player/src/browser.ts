/**
 * Entry of the self-contained browser build (`./browser`).
 *
 * A page loading this build has no other copy of the composition layer, so a
 * host that adds a registration to the packaged set builds the set from here.
 * The npm entry leaves these to `@pie-players/pie-default-tool-loaders`, which
 * npm hosts import directly.
 */
export * from "./pie-section-player.js";
export {
	createPackagedToolRegistry,
	DEFAULT_TOOL_MODULE_LOADERS,
} from "@pie-players/pie-default-tool-loaders";
