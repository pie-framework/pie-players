/**
 * ElementToolStateStore - Manages element-level ephemeral tool state
 *
 * Provides centralized storage for UI tool state (answer eliminations, flags, etc.)
 * that should NOT be sent to the server for scoring. Each element is uniquely identified
 * across the entire assessment using composite keys.
 *
 * Key features:
 * - Element-level granularity (not item-level)
 * - Composite keys for global uniqueness: `assessmentId:sectionId:itemId:elementId`
 * - Cross-section state persistence
 * - Reactive subscriptions
 * - Optional persistence callback integration
 * - Generic solution for any tool
 */

export interface ElementIdComponents {
	assessmentId: string;
	sectionId: string;
	itemId: string;
	elementId: string;
}

export class ElementToolStateStore {
	private elementStates = new Map<string, Map<string, any>>();
	private listeners = new Set<
		(state: Map<string, Map<string, any>>) => void
	>();
	private onStateChange:
		| ((state: Record<string, Record<string, any>>) => void)
		| null = null;

	/**
	 * Generates a globally unique element ID by combining assessment, section, item, and element IDs.
	 * Format: `${assessmentId}:${sectionId}:${itemId}:${elementId}`
	 *
	 * @example
	 * getGlobalElementId('demo-assessment', 'section-1', 'q1', 'mc1')
	 * // Returns: "demo-assessment:section-1:q1:mc1"
	 */
	getGlobalElementId(
		assessmentId: string,
		sectionId: string,
		itemId: string,
		elementId: string,
	): string {
		return `${assessmentId}:${sectionId}:${itemId}:${elementId}`;
	}

	/**
	 * Parses a global element ID into its component parts.
	 *
	 * @example
	 * parseGlobalElementId('demo-assessment:section-1:q1:mc1')
	 * // Returns: { assessmentId: 'demo-assessment', sectionId: 'section-1', itemId: 'q1', elementId: 'mc1' }
	 */
	parseGlobalElementId(globalElementId: string): ElementIdComponents | null {
		const parts = globalElementId.split(":");
		if (parts.length !== 4) return null;
		return {
			assessmentId: parts[0],
			sectionId: parts[1],
			itemId: parts[2],
			elementId: parts[3],
		};
	}

	/**
	 * Sets tool state for a specific element.
	 * Notifies all subscribers and triggers persistence callback.
	 *
	 * @param globalElementId Composite key identifying the element
	 * @param toolId Tool identifier (e.g., 'answerEliminator', 'flagging')
	 * @param state Tool-specific state object
	 */
	setState(globalElementId: string, toolId: string, state: any): void {
		let elementState = this.elementStates.get(globalElementId);
		if (!elementState) {
			elementState = new Map();
			this.elementStates.set(globalElementId, elementState);
		}
		elementState.set(toolId, state);
		this._notifyListeners();
		this._notifyStateChange();
	}

	/**
	 * Gets tool state for a specific element.
	 *
	 * @param globalElementId Composite key identifying the element
	 * @param toolId Tool identifier
	 * @returns Tool state or undefined if not found
	 */
	getState(globalElementId: string, toolId: string): any | undefined {
		return this.elementStates.get(globalElementId)?.get(toolId);
	}

	/**
	 * Gets all tool states for a specific element.
	 *
	 * @param globalElementId Composite key identifying the element
	 * @returns Object with tool states keyed by toolId
	 */
	getElementState(globalElementId: string): Record<string, any> {
		const elementState = this.elementStates.get(globalElementId);
		if (!elementState) return {};
		return Object.fromEntries(elementState.entries());
	}

	/**
	 * Gets all tool states for all elements.
	 * Used for persistence and debugging.
	 *
	 * @returns Nested object: { globalElementId: { toolId: state } }
	 */
	getAllState(): Record<string, Record<string, any>> {
		const result: Record<string, Record<string, any>> = {};
		for (const [globalElementId, toolStates] of this.elementStates.entries()) {
			result[globalElementId] = Object.fromEntries(toolStates.entries());
		}
		return result;
	}

	/**
	 * Subscribes to state changes.
	 * Callback is invoked whenever any element's tool state changes.
	 *
	 * @param callback Function to call on state changes
	 * @returns Unsubscribe function
	 */
	subscribe(
		callback: (state: Map<string, Map<string, any>>) => void,
	): () => void {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}

	private _notifyListeners(): void {
		for (const listener of this.listeners) {
			listener(this.elementStates);
		}
	}

	/**
	 * Sets a callback to be invoked on state changes for persistence integration.
	 * Used by demo/app layer to persist tool state to localStorage or server.
	 *
	 * @param callback Function to call with serialized state on changes
	 */
	setOnStateChange(
		callback: (state: Record<string, Record<string, any>>) => void,
	): void {
		this.onStateChange = callback;
	}

	private _notifyStateChange(): void {
		if (this.onStateChange) {
			this.onStateChange(this.getAllState());
		}
	}

	/**
	 * Loads tool state from serialized format.
	 * Used to restore state from localStorage or server.
	 *
	 * @param state Serialized state object
	 */
	loadState(state: Record<string, Record<string, any>>): void {
		this.elementStates.clear();
		for (const [globalElementId, toolStates] of Object.entries(state)) {
			const elementState = new Map(Object.entries(toolStates));
			this.elementStates.set(globalElementId, elementState);
		}
		this._notifyListeners();
	}

	/**
	 * Clears all tool state for a specific element.
	 *
	 * @param globalElementId Composite key identifying the element
	 */
	clearElement(globalElementId: string): void {
		this.elementStates.delete(globalElementId);
		this._notifyListeners();
		this._notifyStateChange();
	}

	/**
	 * Clears state for a specific tool across all elements.
	 * Useful when disabling a tool globally.
	 *
	 * @param toolId Tool identifier
	 */
	clearTool(toolId: string): void {
		for (const elementState of this.elementStates.values()) {
			elementState.delete(toolId);
		}
		this._notifyListeners();
		this._notifyStateChange();
	}

	/**
	 * Clears all tool state for a specific section.
	 * Useful when unmounting/disposing a section.
	 *
	 * @param assessmentId Assessment identifier
	 * @param sectionId Section identifier
	 */
	clearSection(assessmentId: string, sectionId: string): void {
		const prefix = `${assessmentId}:${sectionId}:`;
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
