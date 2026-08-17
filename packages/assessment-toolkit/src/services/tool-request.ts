/**
 * Tool open requests.
 *
 * A surface that acts on the learner's current selection has to hand that selection
 * to a tool it does not mount. The annotation strip is the case PIE ships: it is a
 * section-scoped singleton in its own shadow root, and the tool it opens is mounted
 * by a toolbar under a scoped instance id the strip cannot construct.
 *
 * Resolution is a claim, not a broadcast. Each toolbar registers as the target for its
 * placement level, and a request reaches exactly one: the first target that currently
 * hosts the tool, preferring section scope. A broadcast would open a panel in every
 * toolbar whose scope contains the selection, which in a section player is the item
 * card's toolbar and the section's both.
 *
 * `params` reaches the tool through the same seam a host-registered context resolver
 * feeds, so receiving a request costs a tool nothing: whatever already reads
 * `getToolRenderParams` sees it.
 *
 * Core names no capability. The requester supplies the tool id, which is why the
 * pairing of a selection action to a dictionary lives in the composition layer.
 */

import type { ToolPlacementLevel } from "./tools-config-normalizer.js";

/** Level a request resolves against when the requester names none. */
export const DEFAULT_TOOL_REQUEST_LEVEL: ToolPlacementLevel = "section";

export interface ToolOpenRequest {
	/** Unscoped tool id, as the registration declares it. */
	toolId: string;
	/**
	 * Merged over the host-resolved render params for this tool rather than
	 * replacing them, so a request carrying a term to look up leaves the endpoint
	 * the host configured in place.
	 */
	params?: Record<string, unknown>;
	/**
	 * Placement level of the toolbar that should open the tool.
	 *
	 * Naming one is a constraint and is honoured strictly: a requester that asks for
	 * `"item"` gets an item toolbar or nothing. Leaving it out asks for whichever
	 * toolbar hosts the tool, preferring `"section"` — the level at which a whole
	 * section shares one instance. A host that places a tool only at item scope would
	 * otherwise have the affordance silently disappear, and configuring a level here
	 * to match a placement made elsewhere is a step it has no reason to expect.
	 *
	 * At `"item"` and `"passage"` a section holds one target per card, and the first
	 * registered one that hosts the tool claims the request. A requester that needs a
	 * particular card's instance cannot express that here, and the gateway PIE ships
	 * does not need to: the strip is a section-scoped singleton acting on passage
	 * selections, so the selection belongs to no card, and what opens is a floating
	 * shell rather than anything rendered inside one.
	 */
	level?: ToolPlacementLevel;
}

export interface ToolRequestTarget {
	/** The placement level this toolbar renders. */
	level: ToolPlacementLevel;
	/** Whether this toolbar currently renders the tool, per its own policy pass. */
	hostsTool: (toolId: string) => boolean;
	/**
	 * Show the tool with `params` already applied.
	 *
	 * Show rather than toggle: a learner who selects a second word and asks for the
	 * dictionary again is asking for the dictionary, and a toggle would close it.
	 */
	open: (toolId: string, params?: Record<string, unknown>) => void;
}

/**
 * Registry of the toolbars a request can reach.
 *
 * Insertion order is the tie-break within a level, so a target registered while an
 * earlier one is still mounted does not displace it.
 */
export class ToolRequestRegistry {
	private readonly targets = new Set<ToolRequestTarget>();
	private readonly changeListeners = new Set<() => void>();

	registerTarget(target: ToolRequestTarget): () => void {
		this.targets.add(target);
		this.notifyChange();
		return () => {
			if (!this.targets.delete(target)) return;
			this.notifyChange();
		};
	}

	/**
	 * Whether a request for this tool would reach a toolbar.
	 *
	 * A surface asks before offering the affordance: a button that silently does
	 * nothing is worse than an absent one, and availability moves with policy —
	 * hence {@link onTargetsChange}.
	 */
	canRequest(toolId: string, level?: ToolPlacementLevel): boolean {
		return this.findTarget(toolId, level) !== null;
	}

	/** Returns whether a target claimed the request. */
	request(request: ToolOpenRequest): boolean {
		const target = this.findTarget(request.toolId, request.level);
		if (!target) return false;
		try {
			target.open(request.toolId, request.params);
		} catch (error) {
			console.error(
				`[ToolRequestRegistry] Target failed to open "${request.toolId}":`,
				error,
			);
			return false;
		}
		return true;
	}

	/**
	 * Fires when a toolbar registers or unregisters.
	 *
	 * Not when a registered toolbar's own visible set changes: `hostsTool` is read
	 * live, so a caller re-asking `canRequest` gets the current answer. A surface
	 * that needs to notice a policy change should also follow the policy signal it
	 * already has.
	 */
	onTargetsChange(listener: () => void): () => void {
		this.changeListeners.add(listener);
		return () => {
			this.changeListeners.delete(listener);
		};
	}

	/**
	 * An explicit level is a constraint; the default is a preference.
	 *
	 * Falling back off `"section"` is what lets a host place a tool at item scope only
	 * and still have a section-scoped gateway reach it. Requesting a level explicitly
	 * does not fall back, because a requester that named one meant it.
	 */
	private findTarget(
		toolId: string,
		level?: ToolPlacementLevel,
	): ToolRequestTarget | null {
		const preferred = this.findTargetAtLevel(
			toolId,
			level ?? DEFAULT_TOOL_REQUEST_LEVEL,
		);
		if (preferred || level !== undefined) return preferred;
		for (const target of this.targets) {
			if (target.level === DEFAULT_TOOL_REQUEST_LEVEL) continue;
			if (this.hostsTool(target, toolId)) return target;
		}
		return null;
	}

	private findTargetAtLevel(
		toolId: string,
		level: ToolPlacementLevel,
	): ToolRequestTarget | null {
		for (const target of this.targets) {
			if (target.level !== level) continue;
			if (this.hostsTool(target, toolId)) return target;
		}
		return null;
	}

	private hostsTool(target: ToolRequestTarget, toolId: string): boolean {
		try {
			return target.hostsTool(toolId) === true;
		} catch (error) {
			console.warn(
				`[ToolRequestRegistry] Target at level "${target.level}" failed the host check for "${toolId}":`,
				error,
			);
			return false;
		}
	}

	private notifyChange(): void {
		for (const listener of this.changeListeners) {
			try {
				listener();
			} catch (error) {
				console.warn(
					"[ToolRequestRegistry] Target change listener threw:",
					error,
				);
			}
		}
	}
}
