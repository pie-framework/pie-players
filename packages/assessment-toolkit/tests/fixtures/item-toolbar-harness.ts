/**
 * Mounts `<pie-item-toolbar>` from source for component tests.
 *
 * The toolbar takes pass 1 from the policy decision of the coordinator that a
 * `<pie-assessment-toolkit>` ancestor publishes in its runtime context, and
 * trusts it verbatim. The harness publishes a coordinator that answers
 * `decideToolPolicy` with the entries a test places, so a test sets pass 1
 * directly and reads passes 2 and 3 off the buttons the toolbar renders. A mount
 * with no placed entries publishes nothing, and the toolbar takes its standalone
 * path, where the `tools` attribute is pass 1.
 *
 * Import this before registering a DOM, as a static import. pie-context then
 * loads under Bun's `Event`, as in every file that dispatches its events on raw
 * `EventTarget`s. Call `loadItemToolbar()` at the top level once the DOM is
 * registered: the component's imports define custom elements, and compiling it
 * takes long enough to belong outside any test's timeout.
 */

import {
	ContextProvider,
	ContextProviderEvent,
	ContextRequestEvent,
} from "@pie-players/pie-context";
import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import {
	type AssessmentToolkitRuntimeContext,
	assessmentToolkitRuntimeContext,
} from "../../src/context/assessment-toolkit-context.js";
import type {
	ToolPolicyDecision,
	ToolPolicyEntry,
} from "../../src/policy/core/decision-types.js";
import type {
	ToolRegistration,
	ToolRegistry,
} from "../../src/services/ToolRegistry.js";
import type { ToolContext } from "../../src/services/tool-context.js";

/** A pass-1 entry: a placed tool, granted when `required` or `alwaysAvailable`. */
export type PlacedTool = Pick<ToolPolicyEntry, "toolId"> &
	Partial<Pick<ToolPolicyEntry, "required" | "alwaysAvailable">>;

export interface ItemToolbarMountOptions {
	registry: ToolRegistry;
	/** Pass 1 through a published coordinator. Omit for the standalone path. */
	placed?: PlacedTool[];
	/** The `tools` attribute, which is pass 1 only on the standalone path. */
	tools?: string;
	item?: ItemEntity | null;
}

export interface MountedItemToolbar {
	toolbar: HTMLElement;
	/** Accessible names of the rendered buttons, in toolbar order. */
	buttonLabels(): string[];
	remove(): Promise<void>;
}

/** Compiles and defines `<pie-item-toolbar>`; a DOM must be registered. */
export async function loadItemToolbar(): Promise<void> {
	await import("../../src/components/ItemToolBar.svelte");
}

/** Lets the toolbar's effects, context handshake and module loads run. */
export async function settle(rounds = 5): Promise<void> {
	for (let round = 0; round < rounds; round += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/** An item whose content has resolved, with one element model. */
export function resolvedItem(id = "item-1"): ItemEntity {
	return {
		id,
		config: {
			markup: '<multiple-choice id="q1"></multiple-choice>',
			elements: { "multiple-choice": "@pie-element/multiple-choice@latest" },
			models: [{ id: "q1", element: "multiple-choice" }],
		},
	} as unknown as ItemEntity;
}

export interface ToolbarToolSpec {
	toolId: string;
	supportedLevels?: ToolRegistration["supportedLevels"];
	/** Pass 2 answer. */
	visible?: (context: ToolContext) => boolean;
	/** Pass 3 answer; omitted declares no applicability gate. */
	applicable?: (context: ToolContext) => boolean;
}

/** A toolbar-toggle registration whose button is labelled with its tool id. */
export function toolbarTool(spec: ToolbarToolSpec): ToolRegistration {
	const { toolId } = spec;
	return {
		toolId,
		name: toolId,
		description: `${toolId} test tool`,
		icon: "test",
		supportedLevels: spec.supportedLevels ?? ["item", "element"],
		isVisibleInContext: spec.visible ?? (() => true),
		...(spec.applicable ? { isApplicableToContent: spec.applicable } : {}),
		renderToolbar: () => ({
			toolId,
			button: {
				toolId,
				label: toolId,
				icon: "test",
				ariaLabel: toolId,
				onClick: () => {},
			},
		}),
	};
}

/**
 * Re-bases pie-context's event classes on the current window's `Event` until the
 * returned restore runs.
 *
 * The classes extend the `Event` of the moment pie-context first loaded, Bun's,
 * and happy-dom's `dispatchEvent` rejects an event that is not an instance of
 * its own window's `Event`, while the toolbar and the provider dispatch these
 * events on real elements. The restore returns them to Bun's `Event` for the
 * files that dispatch them on raw `EventTarget`s, as `shell-scope.test.ts` does.
 */
function adoptContextEvents(): () => void {
	const restores = [ContextRequestEvent, ContextProviderEvent].map(
		(EventClass) => {
			const base = Object.getPrototypeOf(EventClass);
			const baseProto = Object.getPrototypeOf(EventClass.prototype);
			Object.setPrototypeOf(EventClass, window.Event);
			Object.setPrototypeOf(EventClass.prototype, window.Event.prototype);
			return () => {
				Object.setPrototypeOf(EventClass, base);
				Object.setPrototypeOf(EventClass.prototype, baseProto);
			};
		},
	);
	return () => {
		for (const restore of restores) restore();
	};
}

function publishCoordinator(
	host: HTMLElement,
	registry: ToolRegistry,
	placed: PlacedTool[],
): ContextProvider<typeof assessmentToolkitRuntimeContext> {
	const decision: ToolPolicyDecision = {
		visibleTools: placed.map((entry) => ({
			toolId: entry.toolId,
			required: entry.required ?? false,
			alwaysAvailable: entry.alwaysAvailable ?? false,
			sources: ["placement"],
		})),
		diagnostics: [],
		provenance: {} as ToolPolicyDecision["provenance"],
	};
	const toolkitCoordinator = {
		decideToolPolicy: () => decision,
		getPolicyInputs: () => ({ assessment: null, currentItemRef: null }),
		onPolicyChange: () => () => {},
		getToolRegistry: () => registry,
	};
	const provider = new ContextProvider(host, {
		context: assessmentToolkitRuntimeContext,
		initialValue: {
			toolkitCoordinator,
		} as unknown as AssessmentToolkitRuntimeContext,
	});
	provider.connect();
	return provider;
}

export async function mountItemToolbar(
	options: ItemToolbarMountOptions,
): Promise<MountedItemToolbar> {
	await loadItemToolbar();
	const restoreContextEvents = adoptContextEvents();
	const host = document.createElement("div");
	document.body.append(host);
	const provider = options.placed
		? publishCoordinator(host, options.registry, options.placed)
		: null;

	const toolbar = document.createElement("pie-item-toolbar") as HTMLElement &
		Record<string, unknown>;
	toolbar.setAttribute("item-id", options.item?.id ?? "item-1");
	if (options.tools !== undefined) toolbar.setAttribute("tools", options.tools);
	toolbar.toolRegistry = options.registry;
	toolbar.item = options.item ?? resolvedItem();
	host.append(toolbar);
	await settle();

	return {
		toolbar,
		buttonLabels: () =>
			Array.from(
				toolbar.shadowRoot?.querySelectorAll<HTMLButtonElement>(
					"button.item-toolbar__button",
				) ?? [],
			).map((button) => button.getAttribute("aria-label") ?? ""),
		remove: async () => {
			provider?.disconnect();
			host.remove();
			// The component tears down a microtask after it disconnects.
			await settle(1);
			restoreContextEvents();
		},
	};
}
