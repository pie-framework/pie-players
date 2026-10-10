/**
 * ElementToolStateStore: ephemeral UI tool state (answer eliminations, flags and
 * the like), kept out of the session data sent to the server for scoring.
 *
 * State is keyed by a composite global element id,
 * `assessmentId:sectionId:attemptId:itemId:elementId`, unique across the
 * assessment and per attempt: two attempts at one section never share a key.
 * Subscribers see every change, and an optional persistence callback
 * (`setOnStateChange`) receives the serialized state.
 */

/**
 * The parts of a global element id. `attemptId` is `""` when the host names no
 * attempt. A tool whose state belongs to an item or a section rather than to
 * one element leaves `elementId`, and for a section `itemId`, as `""`.
 */
export interface ElementIdComponents {
	assessmentId: string;
	sectionId: string;
	attemptId: string;
	itemId: string;
	elementId: string;
}

const ID_PARTS = [
	"assessmentId",
	"sectionId",
	"attemptId",
	"itemId",
	"elementId",
] as const satisfies readonly (keyof ElementIdComponents)[];

function escapeIdPart(part: string): string {
	return part.replace(/%/g, "%25").replace(/:/g, "%3A");
}

function unescapeIdPart(part: string): string {
	return part.replace(/%(25|3A)/g, (_, code) => (code === "25" ? "%" : ":"));
}

export class ElementToolStateStore {
	private elementStates = new Map<string, Map<string, unknown>>();
	private listeners = new Set<(state: Map<string, Map<string, unknown>>) => void>();
	private onStateChange:
		| ((state: Record<string, Record<string, unknown>>) => void)
		| null = null;

	/**
	 * Generates a globally unique element ID from its parts.
	 * Format: `${assessmentId}:${sectionId}:${attemptId}:${itemId}:${elementId}`,
	 * each part with `%` written as `%25` and `:` as `%3A`, so an id containing
	 * `:` round-trips and cannot collide with another split of the same characters.
	 *
	 * @example
	 * getGlobalElementId({ assessmentId: 'demo-assessment', sectionId: 'section-1',
	 *   attemptId: 'attempt-1', itemId: 'q1', elementId: 'mc1' })
	 * // Returns: "demo-assessment:section-1:attempt-1:q1:mc1"
	 */
	getGlobalElementId(parts: ElementIdComponents): string {
		return ID_PARTS.map((name) => escapeIdPart(parts[name])).join(":");
	}

	/**
	 * Parses a global element ID into its component parts.
	 *
	 * @example
	 * parseGlobalElementId('demo-assessment:section-1:attempt-1:q1:mc1')
	 * // Returns: { assessmentId: 'demo-assessment', sectionId: 'section-1',
	 * //   attemptId: 'attempt-1', itemId: 'q1', elementId: 'mc1' }
	 */
	parseGlobalElementId(globalElementId: string): ElementIdComponents | null {
		const parts = globalElementId.split(":");
		if (parts.length !== ID_PARTS.length) return null;
		const [assessmentId, sectionId, attemptId, itemId, elementId] =
			parts.map(unescapeIdPart);
		return { assessmentId, sectionId, attemptId, itemId, elementId };
	}

	/**
	 * Sets tool state for a specific element.
	 * Notifies all subscribers and triggers persistence callback.
	 */
	setState(globalElementId: string, toolId: string, state: unknown): void {
		let elementState = this.elementStates.get(globalElementId);
		if (!elementState) {
			elementState = new Map();
			this.elementStates.set(globalElementId, elementState);
		}
		elementState.set(toolId, state);
		this._notifyListeners();
		this._notifyStateChange();
	}

	/** One tool's state for an element, or `undefined` when none is set. */
	getState(globalElementId: string, toolId: string): unknown {
		return this.elementStates.get(globalElementId)?.get(toolId);
	}

	/** Every tool's state for an element, keyed by toolId. */
	getElementState(globalElementId: string): Record<string, unknown> {
		const elementState = this.elementStates.get(globalElementId);
		if (!elementState) return {};
		return Object.fromEntries(elementState.entries());
	}

	/**
	 * All state as `{ globalElementId: { toolId: state } }`, for persistence and
	 * debugging.
	 */
	getAllState(): Record<string, Record<string, unknown>> {
		const result: Record<string, Record<string, unknown>> = {};
		for (const [globalElementId, toolStates] of this.elementStates.entries()) {
			result[globalElementId] = Object.fromEntries(toolStates.entries());
		}
		return result;
	}

	/**
	 * Subscribes to state changes.
	 * Callback is invoked whenever any element's tool state changes, including
	 * a `loadState` restore, with a copy of the state that it may keep. Returns
	 * the unsubscribe function.
	 */
	subscribe(
		callback: (state: Map<string, Map<string, unknown>>) => void,
	): () => void {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}

	private _notifyListeners(): void {
		if (this.listeners.size === 0) return;
		const snapshot = new Map(
			[...this.elementStates].map(([key, toolStates]) => [
				key,
				new Map(toolStates),
			]),
		);
		for (const listener of this.listeners) {
			try {
				listener(snapshot);
			} catch (error) {
				console.warn("[ElementToolStateStore] listener failed:", error);
			}
		}
	}

	/**
	 * Sets a callback to be invoked on state changes for persistence integration.
	 * Used by demo/app layer to persist tool state to localStorage or server.
	 */
	setOnStateChange(
		callback: (state: Record<string, Record<string, unknown>>) => void,
	): void {
		this.onStateChange = callback;
	}

	private _notifyStateChange(): void {
		if (!this.onStateChange) return;
		try {
			this.onStateChange(this.getAllState());
		} catch (error) {
			console.warn("[ElementToolStateStore] state-change callback failed:", error);
		}
	}

	/**
	 * Loads tool state from serialized format.
	 * Used to restore state from localStorage or server. Subscribers are
	 * notified; the persistence callback is not, so a restore never writes back.
	 */
	loadState(state: Record<string, Record<string, unknown>>): void {
		this.elementStates.clear();
		for (const [globalElementId, toolStates] of Object.entries(state)) {
			const elementState = new Map(Object.entries(toolStates));
			this.elementStates.set(globalElementId, elementState);
		}
		this._notifyListeners();
	}

	/** Clears all tool state for a specific element. */
	clearElement(globalElementId: string): void {
		this.elementStates.delete(globalElementId);
		this._notifyListeners();
		this._notifyStateChange();
	}

	/**
	 * Clears state for a specific tool across all elements.
	 * Useful when disabling a tool globally.
	 */
	clearTool(toolId: string): void {
		for (const elementState of this.elementStates.values()) {
			elementState.delete(toolId);
		}
		this._notifyListeners();
		this._notifyStateChange();
	}

	/**
	 * Clears all tool state for a specific section, across its attempts.
	 * Useful when unmounting/disposing a section.
	 */
	clearSection(assessmentId: string, sectionId: string): void {
		const prefix = `${escapeIdPart(assessmentId)}:${escapeIdPart(sectionId)}:`;
		const keysToDelete: string[] = [];
		for (const key of this.elementStates.keys()) {
			if (key.startsWith(prefix)) {
				keysToDelete.push(key);
			}
		}
		for (const key of keysToDelete) {
			this.elementStates.delete(key);
		}
		this._notifyListeners();
		this._notifyStateChange();
	}

	/**
	 * Clears all tool state.
	 * Useful when switching between assessments or demos.
	 */
	clearAll(): void {
		this.elementStates.clear();
		this._notifyListeners();
		this._notifyStateChange();
	}
}
