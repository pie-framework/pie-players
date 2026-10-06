/**
 * The types the ruler and protractor check
 * `src/components/overlay-placement/index.ts` against. Their `rootDir` stops at
 * their own package, so they cannot compile this package's Svelte source.
 */
import type { Component } from "svelte";
import type { OverlayPlacementController } from "@pie-players/pie-players-shared";
import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";

export declare const OverlayRotateHandle: Component<
	{
		controller: OverlayPlacementController;
		classPrefix: string;
	},
	{}
>;

export declare const OverlayPlacementControls: Component<
	{
		controller: OverlayPlacementController;
		i18n: I18nProvider;
		classPrefix: string;
		element?: HTMLDivElement;
	},
	{},
	"element"
>;
