/**
 * Tool Registry Factory
 *
 * Creates an empty `ToolRegistry` and installs whatever component overrides and
 * lazy module loaders the caller supplies.
 *
 * It registers nothing by itself, deliberately. Eleven concrete registrations
 * used to live in this package, which made the policy and registry core know
 * every capability by name and left a host unable to contribute one without a PR
 * against this package. The packaged set now lives in the composition layer:
 * `createPackagedToolRegistry` from `@pie-players/pie-default-tool-loaders`.
 */

import type { ToolRegistration, ToolModuleLoader } from "./ToolRegistry.js";
import { ToolRegistry } from "./ToolRegistry.js";
import type {
	ToolComponentFactory,
	ToolComponentFactoryMap,
	ToolTagMap,
} from "../tools/tool-tag-map.js";
import { DEFAULT_TOOL_PLACEMENT } from "./tool-config-defaults.js";

export interface DefaultToolRegistryOptions {
	/**
	 * Registrations to register, keyed by toolId. Nothing is registered when this
	 * is absent.
	 */
	registrations?: Partial<Record<string, ToolRegistration>>;
	/**
	 * Element tag mapping for the registrations being installed. There is no
	 * built-in default: a tag map names capabilities, so it belongs to whoever
	 * decides which capabilities exist.
	 */
	toolTagMap?: Partial<ToolTagMap>;
	/**
	 * Override component creation globally (all tools) or per tool.
	 */
	toolComponentFactory?: ToolComponentFactory;
	toolComponentFactories?: Partial<ToolComponentFactoryMap>;
	/**
	 * Optional lazy module loaders keyed by toolId.
	 */
	toolModuleLoaders?: Partial<Record<string, ToolModuleLoader>>;
}

/**
 * Create a tool registry.
 *
 * @returns an empty `ToolRegistry` unless `registrations` is supplied
 */
export function createDefaultToolRegistry(
	options: DefaultToolRegistryOptions = {},
): ToolRegistry {
	const registry = new ToolRegistry();

	for (const registration of Object.values(options.registrations ?? {})) {
		if (registration) registry.register(registration);
	}

	if (
		options.toolModuleLoaders &&
		Object.keys(options.toolModuleLoaders).length > 0
	) {
		registry.setToolModuleLoaders(options.toolModuleLoaders);
	}

	registry.setComponentOverrides({
		toolTagMap: options.toolTagMap,
		toolComponentFactory: options.toolComponentFactory,
		toolComponentFactories: options.toolComponentFactories,
	});

	return registry;
}

/**
 * Placement configuration with every level empty.
 *
 * The only placement default this package can hold: a populated one would name
 * capabilities. `PACKAGED_TOOL_PLACEMENT` and
 * `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` are in
 * `@pie-players/pie-default-tool-loaders`.
 */
export { DEFAULT_TOOL_PLACEMENT };
