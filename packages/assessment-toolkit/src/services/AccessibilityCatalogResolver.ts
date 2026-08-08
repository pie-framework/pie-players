import type {
	AccessibilityCatalog,
	CatalogCard,
	CatalogCardPayload,
} from "@pie-players/pie-players-shared/types";
import { sanitizeSsmlString } from "./SSMLExtractor.js";

export type CatalogOwnerKind = "global" | "passage" | "itemModel";

export interface CatalogOwnerContext {
	ownerKind: CatalogOwnerKind;
	assessmentId?: string;
	sectionId?: string;
	canonicalItemId?: string;
	itemId?: string;
	passageId?: string;
	modelId?: string;
}

export type CatalogLookupContext = CatalogOwnerContext;

/** What changed in the resolver's catalog set. */
export type CatalogChangeReason =
	| "scoped-registered"
	| "scoped-removed"
	| "item-added"
	| "item-cleared";

/**
 * Emitted after the resolver's catalog set changes.
 *
 * Carries no resolved cards on purpose — a listener re-queries with its own
 * lookup context and options, the same way `ToolPolicyChangeEvent` leaves the
 * new decision to `decideToolPolicy`. `context` is present for the scoped
 * reasons, so a listener can cheaply ignore owners it does not render.
 */
export interface CatalogChangeEvent {
	reason: CatalogChangeReason;
	context?: CatalogOwnerContext;
}

export type CatalogChangeListener = (event: CatalogChangeEvent) => void;

/**
 * Supported accessibility catalog types from QTI 3.0 / APIP
 */
export type CatalogType =
	| "spoken" // Text-to-speech scripts
	| "sign-language" // Video URLs for signed content
	| "braille" // Braille transcriptions
	| "tactile" // Tactile graphics descriptions
	| "simplified-language" // Plain language alternatives
	| "audio-description" // Extended audio descriptions
	| "extended-description" // Extended text descriptions
	| string; // Support custom types

/**
 * Lookup options for catalog resolution
 */
export interface CatalogLookupOptions {
	/** Catalog type (e.g., 'spoken', 'sign-language') */
	type: CatalogType;
	/** Language code (e.g., 'en-US', 'es-ES') */
	language?: string;
	/** Fallback to default language if requested language not found */
	useFallback?: boolean;
	/** Scope used to resolve local catalog idrefs for rendered content */
	context?: CatalogLookupContext;
}

/**
 * Resolved catalog result
 */
export interface ResolvedCatalog {
	/** The catalog identifier */
	catalogId: string;
	/** The catalog type */
	type: CatalogType;
	/** The language code */
	language?: string;
	/**
	 * The string form (SSML, HTML, or plain text). Absent on cards whose content
	 * is structured; those carry `payload` instead.
	 */
	content?: string;
	/**
	 * The structured form, for catalog types a string cannot express — a signing
	 * video's sources, poster, and time range. Interpreted according to `type`.
	 */
	payload?: CatalogCardPayload;
	/** Source of the catalog (assessment or item) */
	source: "assessment" | "item";
}

/**
 * Statistics about available catalogs
 */
export interface CatalogStatistics {
	/** Total number of catalogs */
	totalCatalogs: number;
	/** Number of assessment-level catalogs */
	assessmentCatalogs: number;
	/** Number of item-level catalogs */
	itemCatalogs: number;
	/** Catalog types available */
	availableTypes: Set<CatalogType>;
	/** Languages available */
	availableLanguages: Set<string>;
}

/**
 * Accessibility Catalog Resolver Service
 *
 * Manages QTI 3.0 accessibility catalogs at both assessment and item levels.
 * Provides lookup and resolution services for alternative content representations.
 *
 * @example
 * ```typescript
 * // Initialize with assessment-level catalogs
 * const resolver = new AccessibilityCatalogResolver(assessment.accessibilityCatalogs);
 *
 * // Add item-level catalogs when rendering item
 * resolver.addItemCatalogs(item.accessibilityCatalogs);
 *
 * // Resolve catalog by identifier
 * const spokenContent = resolver.getAlternative('intro-passage', {
 *   type: 'spoken',
 *   language: 'en-US'
 * });
 *
 * // Check if catalog exists
 * if (resolver.hasCatalog('math-problem-1')) {
 *   const braille = resolver.getAlternative('math-problem-1', { type: 'braille' });
 * }
 * ```
 */
export class AccessibilityCatalogResolver {
	private assessmentCatalogs: Map<string, AccessibilityCatalog> = new Map();
	private itemCatalogs: Map<string, AccessibilityCatalog> = new Map();
	private scopedCatalogs = new Map<
		string,
		{
			context: CatalogOwnerContext;
			catalogs: Map<string, AccessibilityCatalog>;
		}
	>();
	// Matches the language the extractor tags cards with and the TTSService
	// passes on lookup ("en-US"), so the default-language fallback rung in
	// findMatchingCard is actually reachable for the common case.
	private defaultLanguage: string = "en-US";
	// Egress sanitization cache. Catalogs are sanitized at registration, but that
	// is a no-op when indexing runs without a DOM (SSR). Sanitizing again as
	// spoken content leaves the resolver guarantees no raw author SSML reaches a
	// provider regardless of where indexing happened; the cache keeps it to one
	// pass per unique string (sanitizeSsmlString is idempotent).
	private sanitizedSpokenCache = new Map<string, string>();
	private catalogChangeListeners = new Set<CatalogChangeListener>();

	constructor(
		assessmentCatalogs?: AccessibilityCatalog[],
		defaultLanguage: string = "en-US",
	) {
		this.defaultLanguage = defaultLanguage;
		this.indexCatalogs(assessmentCatalogs ?? [], "assessment");
	}

	/**
	 * Set the default language for fallback resolution
	 */
	setDefaultLanguage(language: string): void {
		this.defaultLanguage = language;
	}

	/**
	 * Subscribe to catalog registrations and removals.
	 *
	 * Readers that render a catalog — as opposed to TTS, which resolves by DOM
	 * lookup at the moment it speaks — have to compute "is there a card for this
	 * item" before the catalogs exist: registration is driven by an item shell's
	 * mount event, so a card that renders alongside the item legitimately looks
	 * too early. Without a signal the only options are polling on a deadline (no
	 * budget is right: too short strands the accommodation, too long is a visible
	 * delay) or missing the content silently.
	 *
	 * Same contract as `ToolPolicyEngine.onPolicyChange`, deliberately: a listener
	 * plus an unsubscribe, an event that names the `reason` and carries no
	 * resolved state, and subscriber errors swallowed so one bad listener cannot
	 * break registration. Listeners re-query rather than consuming a payload,
	 * which is what keeps the resolver free of assumptions about who is reading.
	 *
	 * Fires after the mutation, so a listener that re-queries sees the new state.
	 *
	 * @returns Unsubscribe function
	 */
	onCatalogsChange(listener: CatalogChangeListener): () => void {
		this.catalogChangeListeners.add(listener);
		return () => {
			this.catalogChangeListeners.delete(listener);
		};
	}

	private emitCatalogsChange(event: CatalogChangeEvent): void {
		// Iterated over a copy: a listener that unsubscribes itself (or another)
		// while handling the event must not make the loop skip its neighbours.
		for (const listener of Array.from(this.catalogChangeListeners)) {
			try {
				listener(event);
			} catch {
				// Subscriber errors must not break registration. Hosts that want
				// error telemetry should wrap their listener.
			}
		}
	}

	/**
	 * Get the default language
	 */
	getDefaultLanguage(): string {
		return this.defaultLanguage;
	}

	/**
	 * Index catalogs into the appropriate map
	 */
	private indexCatalogs(
		catalogs: AccessibilityCatalog[],
		source: "assessment" | "item",
	): void {
		const targetMap =
			source === "assessment" ? this.assessmentCatalogs : this.itemCatalogs;

		for (const catalog of this.sanitizeCatalogs(catalogs)) {
			if (targetMap.has(catalog.identifier)) {
				console.warn(
					`[AccessibilityCatalogResolver] Duplicate ${source} catalog "${catalog.identifier}" ignored`,
				);
				continue;
			}
			targetMap.set(catalog.identifier, catalog);
		}
	}

	registerCatalogs(
		context: CatalogOwnerContext,
		catalogs?: AccessibilityCatalog[],
	): () => void {
		if (!catalogs || catalogs.length === 0) return () => {};
		const key = this.getOwnerKey(context);
		const existing = this.scopedCatalogs.get(key);
		const scoped =
			existing?.catalogs ?? new Map<string, AccessibilityCatalog>();
		const insertedIds: string[] = [];
		for (const catalog of this.sanitizeCatalogs(catalogs)) {
			if (scoped.has(catalog.identifier)) {
				console.warn(
					`[AccessibilityCatalogResolver] Duplicate scoped catalog "${catalog.identifier}" ignored for ${key}`,
				);
				continue;
			}
			scoped.set(catalog.identifier, catalog);
			insertedIds.push(catalog.identifier);
		}
		if (!existing) {
			this.scopedCatalogs.set(key, {
				context: { ...context },
				catalogs: scoped,
			});
		}
		// Only when something was actually inserted: an all-duplicates call changes
		// nothing, and waking every reader to re-resolve for that would make the
		// signal untrustworthy.
		if (insertedIds.length > 0) {
			this.emitCatalogsChange({ reason: "scoped-registered", context });
		}
		return () => {
			const current = this.scopedCatalogs.get(key);
			if (current?.catalogs !== scoped) return;
			for (const insertedId of insertedIds) {
				current.catalogs.delete(insertedId);
			}
			if (current.catalogs.size === 0) {
				this.scopedCatalogs.delete(key);
			}
			if (insertedIds.length > 0) {
				this.emitCatalogsChange({ reason: "scoped-removed", context });
			}
		};
	}

	/**
	 * Add item-level catalogs (called when rendering a new item)
	 */
	addItemCatalogs(catalogs?: AccessibilityCatalog[]): void {
		if (!catalogs || catalogs.length === 0) return;
		this.indexCatalogs(catalogs, "item");
		this.emitCatalogsChange({ reason: "item-added" });
	}

	/**
	 * Clear item-level catalogs (called when leaving an item)
	 */
	clearItemCatalogs(): void {
		if (this.itemCatalogs.size === 0) return;
		this.itemCatalogs.clear();
		this.emitCatalogsChange({ reason: "item-cleared" });
	}

	/**
	 * Check if a catalog exists (checks both assessment and item levels)
	 */
	hasCatalog(catalogId: string): boolean {
		return (
			this.itemCatalogs.has(catalogId) ||
			this.assessmentCatalogs.has(catalogId) ||
			Array.from(this.scopedCatalogs.values()).some((owner) =>
				owner.catalogs.has(catalogId),
			)
		);
	}

	/**
	 * Get alternative content for a catalog identifier
	 *
	 * Priority: Item-level catalogs take precedence over assessment-level
	 */
	getAlternative(
		catalogId: string,
		options: CatalogLookupOptions,
	): ResolvedCatalog | null {
		const scopedCatalog = options.context
			? this.scopedCatalogs
					.get(this.getOwnerKey(options.context))
					?.catalogs.get(catalogId)
			: null;
		if (scopedCatalog) {
			const card = this.findMatchingCard(scopedCatalog, options);
			if (card) return this.resolveCard(catalogId, card, "item");
		}
		if (options.context) {
			const candidates = this.findScopedCandidates(catalogId, options.context);
			if (candidates.length === 1) {
				const card = this.findMatchingCard(candidates[0], options);
				if (card) return this.resolveCard(catalogId, card, "item");
			} else if (candidates.length > 1) {
				console.warn(
					`[AccessibilityCatalogResolver] Ambiguous scoped catalog "${catalogId}" for owner context`,
					options.context,
				);
				return null;
			}
		}

		// Check item-level first (higher precedence)
		const itemCatalog = this.itemCatalogs.get(catalogId);
		if (itemCatalog) {
			const card = this.findMatchingCard(itemCatalog, options);
			if (card) return this.resolveCard(catalogId, card, "item");
		}

		// Fallback to assessment-level
		const assessmentCatalog = this.assessmentCatalogs.get(catalogId);
		if (assessmentCatalog) {
			const card = this.findMatchingCard(assessmentCatalog, options);
			if (card) return this.resolveCard(catalogId, card, "assessment");
		}

		return null;
	}

	private resolveCard(
		catalogId: string,
		card: CatalogCard,
		source: ResolvedCatalog["source"],
	): ResolvedCatalog {
		return {
			catalogId,
			type: card.catalog,
			language: card.language,
			content:
				card.catalog === "spoken" && card.content !== undefined
					? this.ensureSpokenSanitized(card.content)
					: card.content,
			// `signLanguage` is the alias two landed producers use; folded in here so
			// exactly one field reaches consumers. See `CatalogCard.signLanguage`.
			payload: card.payload ?? card.signLanguage,
			source,
		};
	}

	private ensureSpokenSanitized(content: string): string {
		const cached = this.sanitizedSpokenCache.get(content);
		if (cached !== undefined) return cached;
		const sanitized = sanitizeSsmlString(content);
		this.sanitizedSpokenCache.set(content, sanitized);
		return sanitized;
	}

	private getOwnerKey(context: CatalogOwnerContext): string {
		return [
			context.ownerKind,
			context.assessmentId || "",
			context.sectionId || "",
			context.canonicalItemId || "",
			context.itemId || "",
			context.passageId || "",
			context.modelId || "",
		].join("|");
	}

	// Flattened [id, catalog] pairs for every context-scoped owner. The primary
	// runtime path registers catalogs as scoped, so enumeration APIs must include
	// these or they silently under-report what TTS content exists.
	private scopedCatalogEntries(): Array<[string, AccessibilityCatalog]> {
		const entries: Array<[string, AccessibilityCatalog]> = [];
		for (const owner of this.scopedCatalogs.values()) {
			for (const entry of owner.catalogs.entries()) {
				entries.push(entry);
			}
		}
		return entries;
	}

	private findScopedCandidates(
		catalogId: string,
		context: CatalogOwnerContext,
	): AccessibilityCatalog[] {
		return Array.from(this.scopedCatalogs.values())
			.filter((owner) => this.isCompatibleOwnerContext(owner.context, context))
			.map((owner) => owner.catalogs.get(catalogId))
			.filter((catalog): catalog is AccessibilityCatalog => Boolean(catalog));
	}

	private isCompatibleOwnerContext(
		registered: CatalogOwnerContext,
		lookup: CatalogOwnerContext,
	): boolean {
		if (registered.ownerKind !== lookup.ownerKind) return false;
		if (
			lookup.assessmentId &&
			registered.assessmentId !== lookup.assessmentId
		) {
			return false;
		}
		if (lookup.sectionId && registered.sectionId !== lookup.sectionId) {
			return false;
		}
		if (
			lookup.canonicalItemId &&
			registered.canonicalItemId !== lookup.canonicalItemId
		) {
			return false;
		}
		if (lookup.itemId && registered.itemId !== lookup.itemId) {
			return false;
		}
		if (lookup.passageId && registered.passageId !== lookup.passageId) {
			return false;
		}
		if (lookup.modelId && registered.modelId !== lookup.modelId) {
			return false;
		}
		return true;
	}

	private sanitizeCatalogs(
		catalogs: AccessibilityCatalog[],
	): AccessibilityCatalog[] {
		return catalogs.map((catalog) => ({
			...catalog,
			cards: catalog.cards.map((card) => ({
				...card,
				content:
					card.catalog === "spoken" && card.content !== undefined
						? sanitizeSsmlString(card.content)
						: card.content,
			})),
		}));
	}

	/**
	 * Find a matching catalog card based on lookup options
	 */
	private findMatchingCard(
		catalog: AccessibilityCatalog,
		options: CatalogLookupOptions,
	): CatalogCard | null {
		const { type, language, useFallback = true } = options;

		// Try exact match (type + language)
		if (language) {
			const exactMatch = catalog.cards.find(
				(card) => card.catalog === type && card.language === language,
			);
			if (exactMatch) return exactMatch;
		}

		// Try type match with default language (if fallback enabled)
		if (useFallback) {
			const defaultMatch = catalog.cards.find(
				(card) =>
					card.catalog === type && card.language === this.defaultLanguage,
			);
			if (defaultMatch) return defaultMatch;

			// Try type match without language constraint
			const typeMatch = catalog.cards.find((card) => card.catalog === type);
			if (typeMatch) return typeMatch;
		}

		return null;
	}

	/**
	 * Get all available alternatives for a catalog identifier
	 */
	getAllAlternatives(catalogId: string): ResolvedCatalog[] {
		const results: ResolvedCatalog[] = [];

		// Add item-level alternatives
		const itemCatalog = this.itemCatalogs.get(catalogId);
		if (itemCatalog) {
			for (const card of itemCatalog.cards) {
				results.push({
					catalogId,
					type: card.catalog,
					language: card.language,
					content: card.content,
					payload: card.payload,
					source: "item",
				});
			}
		}

		// Add assessment-level alternatives (if not already provided by item)
		const assessmentCatalog = this.assessmentCatalogs.get(catalogId);
		if (assessmentCatalog) {
			for (const card of assessmentCatalog.cards) {
				// Only add if not already provided by item catalog
				const exists = results.some(
					(r) => r.type === card.catalog && r.language === card.language,
				);
				if (!exists) {
					results.push({
						catalogId,
						type: card.catalog,
						language: card.language,
						content: card.content,
						payload: card.payload,
						source: "assessment",
					});
				}
			}
		}

		// Add scoped (context-registered) alternatives. These resolve as "item"
		// in getAlternative, so report them the same way here.
		for (const [id, catalog] of this.scopedCatalogEntries()) {
			if (id !== catalogId) continue;
			for (const card of catalog.cards) {
				const exists = results.some(
					(r) => r.type === card.catalog && r.language === card.language,
				);
				if (!exists) {
					results.push({
						catalogId,
						type: card.catalog,
						language: card.language,
						content: card.content,
						payload: card.payload,
						source: "item",
					});
				}
			}
		}

		return results;
	}

	/**
	 * Get all catalog identifiers available (both assessment and item)
	 */
	getAllCatalogIds(): string[] {
		const scopedIds = this.scopedCatalogEntries().map(([id]) => id);
		return Array.from(
			new Set([
				...this.itemCatalogs.keys(),
				...this.assessmentCatalogs.keys(),
				...scopedIds,
			]),
		);
	}

	/**
	 * Get statistics about available catalogs
	 */
	getStatistics(): CatalogStatistics {
		const allTypes = new Set<CatalogType>();
		const allLanguages = new Set<string>();

		// Collect from assessment catalogs
		for (const catalog of this.assessmentCatalogs.values()) {
			for (const card of catalog.cards) {
				allTypes.add(card.catalog);
				if (card.language) allLanguages.add(card.language);
			}
		}

		// Collect from item catalogs
		for (const catalog of this.itemCatalogs.values()) {
			for (const card of catalog.cards) {
				allTypes.add(card.catalog);
				if (card.language) allLanguages.add(card.language);
			}
		}

		return {
			totalCatalogs:
				this.assessmentCatalogs.size +
				this.itemCatalogs.size +
				Array.from(this.scopedCatalogs.values()).reduce(
					(total, owner) => total + owner.catalogs.size,
					0,
				),
			assessmentCatalogs: this.assessmentCatalogs.size,
			itemCatalogs:
				this.itemCatalogs.size +
				Array.from(this.scopedCatalogs.values()).reduce(
					(total, owner) => total + owner.catalogs.size,
					0,
				),
			availableTypes: allTypes,
			availableLanguages: allLanguages,
		};
	}

	/**
	 * Check if a specific catalog type is available for a given catalog ID
	 */
	hasAlternativeType(catalogId: string, type: CatalogType): boolean {
		const alternatives = this.getAllAlternatives(catalogId);
		return alternatives.some((alt) => alt.type === type);
	}

	/**
	 * Get all catalog IDs that have a specific type of alternative
	 */
	getCatalogsByType(type: CatalogType): string[] {
		const catalogIds = new Set<string>();

		for (const [id, catalog] of this.assessmentCatalogs.entries()) {
			if (catalog.cards.some((card) => card.catalog === type)) {
				catalogIds.add(id);
			}
		}

		for (const [id, catalog] of this.itemCatalogs.entries()) {
			if (catalog.cards.some((card) => card.catalog === type)) {
				catalogIds.add(id);
			}
		}

		for (const [id, catalog] of this.scopedCatalogEntries()) {
			if (catalog.cards.some((card) => card.catalog === type)) {
				catalogIds.add(id);
			}
		}

		return Array.from(catalogIds);
	}

	/**
	 * Reset all catalogs (both assessment and item)
	 */
	reset(): void {
		this.assessmentCatalogs.clear();
		this.itemCatalogs.clear();
		this.scopedCatalogs.clear();
		this.sanitizedSpokenCache.clear();
	}

	/**
	 * Destroy and cleanup
	 */
	destroy(): void {
		this.reset();
	}
}
