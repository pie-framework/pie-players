/**
 * Entry of the self-contained browser build (`./browser`).
 *
 * A page loading this build has no other copy of the composition layer, so a
 * host that adds a registration to the packaged set builds the set from here,
 * and reads the set's preferred placement and universal profile from the same
 * release. The npm entry leaves these to `@pie-players/pie-default-tool-loaders`,
 * which npm hosts import directly.
 */
export * from "./pie-section-player.js";
export {
	createCalculatorToolRegistration,
	createPackagedToolRegistry,
	createUniversalPersonalNeedsProfile,
	DEFAULT_TOOL_MODULE_LOADERS,
	SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
} from "@pie-players/pie-default-tool-loaders";
