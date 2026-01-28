/**
 * Context Variable Store
 *
 * Standalone service for managing QTI 3.0 context variables.
 * Context variables are global assessment-level variables that can be
 * shared across items.
 *
 * Can be used independently by any assessment player without requiring
 * the full AssessmentPlayer.
 *
 * Part of PIE Assessment Toolkit.
 */

import type { ContextDeclaration } from "@pie-players/pie-players-shared/types";

/**
 * Standalone service for managing QTI 3.0 context variables.
 *
 * Context variables are global assessment-level variables that can be
 * shared across items. Can be used independently by any assessment player.
 *
 * @example
 * ```typescript
 * // Initialize with declarations
 * const store = new ContextVariableStore(declarations);
 *
 * // Get/set variables
 * const seed = store.get('RANDOM_SEED');
 * store.set('DIFFICULTY_LEVEL', 'hard');
 *
 * // Pass to items
 * const context = store.toObject();
 * await renderItem(item, session, context);
 *
 * // Persist in session
 * session.contextVariables = store.toObject();
 * ```
 */
export class ContextVariableStore {
	private variables: Map<string, any> = new Map();
	private declarations: Map<string, ContextDeclaration> = new Map();

	/**
	 * Initialize store with context declarations from assessment
	 *
	 * @param declarations QTI 3.0 context declarations
	 */
	constructor(declarations?: ContextDeclaration[]) {
		if (declarations) {
			this.initialize(declarations);
		}
	}

	/**
	 * Initialize context variables from declarations
	 *
	 * Sets each variable to its defaultValue or type-appropriate default.
	 */
	initialize(declarations: ContextDeclaration[]): void {
		this.declarations.clear();
		this.variables.clear();

		for (const decl of declarations) {
			this.declarations.set(decl.identifier, decl);

			const value =
				decl.defaultValue ??
				this.getDefaultValueForType(decl.baseType, decl.cardinality);

			this.variables.set(decl.identifier, value);
		}

		console.debug(
			`ContextVariableStore: Initialized ${declarations.length} context variables:`,
			Array.from(this.variables.keys()),
		);
	}

	/**
	 * Get context variable value
	 *
	 * @param identifier Variable identifier
	 * @returns Variable value or undefined if not found
	 */
	get(identifier: string): any {
		return this.variables.get(identifier);
	}

	/**
	 * Set context variable value
	 *
	 * @param identifier Variable identifier
	 * @param value New value
	 */
	set(identifier: string, value: any): void {
		if (!this.declarations.has(identifier)) {
			console.warn(
				`ContextVariableStore: Setting undeclared context variable: ${identifier}`,
				"Consider declaring it in contextDeclarations",
			);
		}

		// Type validation (optional but recommended)
		const decl = this.declarations.get(identifier);
		if (decl) {
			this.validateValue(decl, value);
		}

		this.variables.set(identifier, value);
	}

	/**
	 * Check if variable exists
	 */
	has(identifier: string): boolean {
		return this.variables.has(identifier);
	}

	/**
	 * Get all variable names
	 */
	getIdentifiers(): string[] {
		return Array.from(this.variables.keys());
	}

	/**
	 * Get all variables as object (for passing to PIE elements)
	 *
	 * @returns Plain object with all context variables
	 */
	toObject(): Record<string, any> {
		return Object.fromEntries(this.variables);
	}

	/**
	 * Load state from serialized object (for session restore)
	 *
	 * @param state Object containing context variable values
	 */
	fromObject(state: Record<string, any>): void {
		for (const [key, value] of Object.entries(state)) {
			this.variables.set(key, value);
		}
	}

	/**
	 * Clear all variables (reset to defaults)
	 */
	reset(): void {
		for (const [identifier, decl] of this.declarations) {
			const value =
				decl.defaultValue ??
				this.getDefaultValueForType(decl.baseType, decl.cardinality);
			this.variables.set(identifier, value);
		}

		console.debug("ContextVariableStore: Reset to default values");
	}

	/**
	 * Get declaration for variable
	 *
	 * @param identifier Variable identifier
	 * @returns Declaration or undefined if not found
	 */
	getDeclaration(identifier: string): ContextDeclaration | undefined {
		return this.declarations.get(identifier);
	}

	/**
	 * Get all declarations
	 */
	getDeclarations(): ContextDeclaration[] {
		return Array.from(this.declarations.values());
	}

	/**
	 * Get default value for QTI base type
	 *
	 * @private
	 */
	private getDefaultValueForType(
		baseType: string,
		cardinality: string,
	): any {
		if (cardinality === "multiple" || cardinality === "ordered") {
			return [];
		}

		if (cardinality === "record") {
			return {};
		}

		// Single cardinality defaults
		switch (baseType) {
			case "boolean":
				return false;
			case "integer":
				return 0;
			case "float":
				return 0.0;
			case "string":
			case "identifier":
			case "uri":
				return "";
			case "point":
				return [0, 0];
			case "pair":
				return ["", ""];
			case "directedPair":
				return ["", ""];
			case "duration":
				return 0;
			case "file":
				return null;
			default:
				return null;
		}
	}

	/**
	 * Validate value matches declared type (basic validation)
	 *
	 * @private
	 */
	private validateValue(decl: ContextDeclaration, value: any): void {
		// Basic type checking - can be extended
		if (decl.baseType === "integer" && !Number.isInteger(value)) {
			console.warn(
				`ContextVariableStore: Variable ${decl.identifier} expects integer, got:`,
				typeof value,
			);
		}

		if (decl.baseType === "float" && typeof value !== "number") {
			console.warn(
				`ContextVariableStore: Variable ${decl.identifier} expects float, got:`,
				typeof value,
			);
		}

		if (decl.baseType === "boolean" && typeof value !== "boolean") {
			console.warn(
				`ContextVariableStore: Variable ${decl.identifier} expects boolean, got:`,
				typeof value,
			);
		}

		if (
			(decl.cardinality === "multiple" || decl.cardinality === "ordered") &&
			!Array.isArray(value)
		) {
			console.warn(
				`ContextVariableStore: Variable ${decl.identifier} expects array (cardinality: ${decl.cardinality}), got:`,
				typeof value,
			);
		}
	}
}
