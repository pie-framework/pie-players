/**
 * What a section player hands its items and passages panes.
 *
 * The layout kernel publishes it on the layout element, and each pane requests it
 * from its own position in the DOM, so a pane renders wherever a layout places it
 * under that element: the stock layouts' markup, or a host's own children of
 * `<pie-section-player-kernel-host>`. Hosts never read it.
 *
 * One pane of each kind renders: the first to register. Readiness follows the
 * items pane, so `pie-loading-complete` waits for one to be connected; a section
 * with no passages needs no passages pane. Any further pane of a kind renders
 * nothing and takes over when the rendering one disconnects.
 */

import type {
	ToolRegistry,
	ToolbarItem,
} from "@pie-players/pie-assessment-toolkit";
import {
	connectContextWithRetry,
	ContextProvider,
	createContext,
} from "@pie-players/pie-context";
import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import type { SectionCompositionModel } from "../../controllers/types.js";
import type {
	ElementPreloadErrorDetail,
	ElementPreloadRetryDetail,
} from "./player-preload.js";
import type { HeadingLevel } from "./section-player-view-state.js";

export type SectionPlayerPaneKind = "items" | "passages";

/** Where the items pane's element pre-warm stands. */
export type SectionPlayerPaneWarmup = "pending" | "loaded" | "failed";

export type SectionPlayerPaneReport = {
	warmup: SectionPlayerPaneWarmup;
	/** The renderables signature the report was made for. */
	renderablesSignature: string;
};

export type SectionPlayerLayoutContext = {
	/** The layout element's tag, which labels the items pane's preload reports. */
	componentTag: string;
	items: SectionCompositionModel["items"];
	passages: SectionCompositionModel["passages"];
	compositionModel: SectionCompositionModel;
	preloadedRenderables: ItemEntity[];
	preloadedRenderablesSignature: string;
	preloadEnabled: boolean;
	resolvedPlayerEnv: Record<string, unknown>;
	resolvedPlayerAttributes: Record<string, string>;
	resolvedPlayerProps: Record<string, unknown>;
	playerStrategy: string;
	baseHeadingLevel: HeadingLevel;
	iifeBundleHost: string | null;
	toolRegistry: ToolRegistry;
	itemToolbarTools: string;
	passageToolbarTools: string;
	itemHostButtons: ToolbarItem[];
	passageHostButtons: ToolbarItem[];
	/**
	 * Whether the items pane's element pre-warm has resolved for the current
	 * composition; the passages pane shows its loading card until it has.
	 */
	elementsLoaded: boolean;
	/** The pane of each kind that renders. */
	activePanes: Readonly<Record<SectionPlayerPaneKind, Element | null>>;
	/** Returns the unregister. */
	registerPane: (kind: SectionPlayerPaneKind, pane: Element) => () => void;
	/** Reports from any pane but the active items pane are ignored. */
	reportWarmup: (pane: Element, report: SectionPlayerPaneReport) => void;
	reportPreloadRetry: (pane: Element, detail: ElementPreloadRetryDetail) => void;
	reportPreloadError: (pane: Element, detail: ElementPreloadErrorDetail) => void;
};

export const sectionPlayerLayoutContext =
	createContext<SectionPlayerLayoutContext>(
		Symbol.for("@pie-players/pie-section-player/layout-context"),
	);

export function connectSectionPlayerLayoutContext(
	host: HTMLElement,
	onValue: (value: SectionPlayerLayoutContext) => void,
): () => void {
	return connectContextWithRetry(host, sectionPlayerLayoutContext, onValue);
}

/**
 * A pane that subscribes before this provider connects is answered through the
 * document's context root, which replays its request when the provider
 * announces itself.
 */
export function createSectionPlayerLayoutContextProvider(
	host: HTMLElement,
	initialValue: SectionPlayerLayoutContext,
) {
	const provider = new ContextProvider(host, {
		context: sectionPlayerLayoutContext,
		initialValue,
	});
	provider.connect();
	return {
		setValue: (value: SectionPlayerLayoutContext) => provider.setValue(value),
		disconnect: () => provider.disconnect(),
	};
}

export type SectionPlayerPaneRegistry = {
	register: (kind: SectionPlayerPaneKind, pane: Element) => () => void;
	active: () => Record<SectionPlayerPaneKind, Element | null>;
	dispose: () => void;
};

/**
 * The panes registered with one section player, in registration order.
 *
 * `onChange` receives the active pane of each kind after every change. A second
 * pane of a kind still registered a task later is a layout that renders the
 * kind twice, reported once per registry through `warn`; the deferral lets a
 * layout replace a pane without being reported.
 */
export function createSectionPlayerPaneRegistry(options: {
	onChange: (active: Record<SectionPlayerPaneKind, Element | null>) => void;
	warn?: (message: string) => void;
}): SectionPlayerPaneRegistry {
	const warn = options.warn ?? ((message: string) => console.warn(message));
	const registered: Record<SectionPlayerPaneKind, Element[]> = {
		items: [],
		passages: [],
	};
	const reported = new Set<SectionPlayerPaneKind>();
	const pendingChecks = new Set<ReturnType<typeof setTimeout>>();
	let disposed = false;

	const active = () => ({
		items: registered.items[0] ?? null,
		passages: registered.passages[0] ?? null,
	});

	const checkDuplicates = (kind: SectionPlayerPaneKind) => {
		const count = registered[kind].length;
		if (disposed || count < 2 || reported.has(kind)) return;
		reported.add(kind);
		const tag = `pie-section-player-${kind}-pane`;
		warn(
			`[pie-section-player] ${count} <${tag}> elements are inside one section player. The first one connected renders and the rest render nothing until it disconnects. Reported once per section player.`,
		);
	};

	return {
		register(kind, pane) {
			const panes = registered[kind];
			if (!panes.includes(pane)) panes.push(pane);
			options.onChange(active());
			if (panes.length > 1 && !reported.has(kind)) {
				const handle = setTimeout(() => {
					pendingChecks.delete(handle);
					checkDuplicates(kind);
				}, 0);
				pendingChecks.add(handle);
			}
			return () => {
				const index = panes.indexOf(pane);
				if (index < 0) return;
				panes.splice(index, 1);
				if (!disposed) options.onChange(active());
			};
		},
		active,
		dispose() {
			disposed = true;
			for (const handle of pendingChecks) clearTimeout(handle);
			pendingChecks.clear();
		},
	};
}
