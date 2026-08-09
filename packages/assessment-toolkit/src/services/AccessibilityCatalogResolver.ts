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
	| "spoken" // Text-to-speech scripts, or a recording of one
	| "sign-language" // Signing video
	| "transcript" // Text transcript of an audio stimulus
	| "braille" // Braille transcriptions
	| "tactile" // Tactile graphics descriptions
	| "simplified-language" // Plain language alternatives
	| "audio-description" // Extended audio descriptions
	| "extended-description" // Extended text descriptions
	| string; // Support custom types — see isKnownCatalogType

/**
 * The catalog types PIE names, plus the rule for the ones it does not.
 *
 * The type above stays open on purpose: QTI treats the support vocabulary as
 * extensible, and closing it here would reject content PIE has no reason to
 * reject and could not usefully validate anyway, since catalogs arrive as
 * authored JSON rather than through this type. Keeping it open cost something
 * though — the named literals were documentation only, so a card written
 * `"spokn"` was a perfectly valid `CatalogType` that no reader would ever ask
 * for, and it failed by being invisible rather than by failing. That is what
 * `isKnownCatalogType` and the warnings below are for: the openness stays, the
 * silence does not.
 */
export const KNOWN_CATALOG_TYPES: ReadonlySet<string> = new Set([
	"spoken",
	"sign-language",
	"transcript",
	"braille",
	"tactile",
	"simplified-language",
	"audio-description",
	"extended-description",
]);

/**
 * QTI reserves an `ext:` prefix for vendor extensions, and pairs such a card
 * with a standard one on the same node in its own examples. A prefixed token is
 * therefore a deliberate extension rather than a typo, and passes without
 * comment even though PIE ships no consumer for it.
 */
const EXTENSION_TYPE_PREFIX = "ext:";

export function isKnownCatalogType(type: string): boolean {
	if (KNOWN_CATALOG_TYPES.has(type)) return true;
	return (
		type.startsWith(EXTENSION_TYPE_PREFIX) &&
		type.length > EXTENSION_TYPE_PREFIX.length
	);
}

// One report per distinct token per side, because the interesting information is
// "this token is not a thing", and repeating it per card or per lookup would bury
// it under itself.
const reportedUnknownTypes = new Set<string>();

function reportUnknownCatalogType(
	type: string,
	side: "card" | "lookup",
	where: string,
): void {
	const key = `${side}|${type}`;
	if (reportedUnknownTypes.has(key)) return;
	reportedUnknownTypes.add(key);
	const known = `${Array.from(KNOWN_CATALOG_TYPES).join(", ")}, or an "${EXTENSION_TYPE_PREFIX}" prefixed vendor extension`;
	if (side === "card") {
		console.warn(
			`[AccessibilityCatalogResolver] catalog "${where}" has a card of unknown type "${type}"; it is stored but no reader asks for that type, so the alternate will never be shown. Expected one of: ${known}.`,
		);
		return;
	}
	console.warn(
		`[AccessibilityCatalogResolver] lookup for unknown catalog type "${type}" on "${where}" cannot match any card. Expected one of: ${known}.`,
	);
}

/**
 * Which of a card's two content slots it fills.
 *
 * Not a new field on the card and not a second discriminant: the card already
 * says which form it is by carrying `content` or `payload`, and the
 * exactly-one-of invariant is what makes that unambiguous. This names the
 * distinction so a lookup can ask for one.
 */
export type CatalogCardForm = "content" | "payload";

export const catalogCardForm = (card: CatalogCard): CatalogCardForm =>
	card.payload !== undefined ? "payload" : "content";

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
	/**
	 * Preferred content form, when one catalog type legitimately has both on the
	 * same node.
	 *
	 * The case this exists for is a `spoken` node carrying both a reading script
	 * and a recording of it — which is APIP's authoring pattern and what QTI 3's
	 * migration guidance tells you to keep, the script doubling as the source the
	 * audio was generated from and as the fallback when it cannot play. Before
	 * this, both resolution rungs took the first card matching type and language,
	 * so whichever of the two was written second in the array was unreachable and
	 * nothing said so.
	 *
	 * A preference, not a filter: if the requested form is not present, the other
	 * one is still returned. Callers that cannot use a form must check what they
	 * got, exactly as they already must for a card of a type they did not expect.
	 */
	form?: CatalogCardForm;
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
		// A typo on this side is as silent as one on a card: the lookup simply finds
		// nothing and the caller reads that as "no alternate authored".
		if (!isKnownCatalogType(options.type)) {
			reportUnknownCatalogType(options.type, "lookup", catalogId);
		}
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
			payload: card.payload,
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

	// The single funnel every registration path runs through — the constructor and
	// `addItemCatalogs` by way of `indexCatalogs`, and `registerCatalogs`
	// directly — which is why the unknown-type report lives here rather than at
	// each entry point.
	private sanitizeCatalogs(
		catalogs: AccessibilityCatalog[],
	): AccessibilityCatalog[] {
		return catalogs.map((catalog) => ({
			...catalog,
			cards: catalog.cards.map((card) => {
				if (!isKnownCatalogType(card.catalog)) {
					reportUnknownCatalogType(card.catalog, "card", catalog.identifier);
				}
				return {
					...card,
					content:
						card.catalog === "spoken" && card.content !== undefined
							? sanitizeSsmlString(card.content)
							: card.content,
				};
			}),
		}));
	}

	/**
	 * Find a matching catalog card based on lookup options
	 */
	private findMatchingCard(
		catalog: AccessibilityCatalog,
		options: CatalogLookupOptions,
	): CatalogCard | null {
		const { type, language, useFallback = true, form } = options;

		// Language rungs, most specific first: requested language, then the default
		// language, then any. Unchanged — only what happens *within* a rung is new.
		const languageRungs: Array<(card: CatalogCard) => boolean> = [];
		if (language) {
			languageRungs.push((card) => card.language === language);
		}
		if (useFallback) {
			languageRungs.push((card) => card.language === this.defaultLanguage);
			languageRungs.push(() => true);
		}

		for (const matchesLanguage of languageRungs) {
			const candidates = catalog.cards.filter(
				(card) => card.catalog === type && matchesLanguage(card),
			);
			if (candidates.length === 0) continue;
			// Form is preferred inside a language rung and never across them: a
			// recording in the requested language beats a script in that language,
			// but a script in the requested language beats a recording in another
			// one. Getting this backwards would answer a Spanish lookup with English
			// audio, which is worse than answering it with Spanish text.
			if (form) {
				const preferred = candidates.find(
					(card) => catalogCardForm(card) === form,
				);
				if (preferred) return preferred;
			}
			// No preference expressed, or the preferred form is absent: first match,
			// which is what every caller got before form preference existed.
			return candidates[0];
		}

		return null;
	}

	/**
	 * Get all available alternatives for a catalog identifier
	 *
	 * Every card goes through `resolveCard`, the same projection `getAlternative`
	 * uses, so enumeration cannot describe a card differently from the resolution
	 * that renders it. It was hand-rolled here once and drifted immediately: the
	 * `signLanguage` alias was folded in on the resolution path only, so a card
	 * that arrived under the alias rendered correctly and was still reported as
	 * carrying no payload by anything asking what alternates exist.
	 */
	getAllAlternatives(catalogId: string): ResolvedCatalog[] {
		const results: ResolvedCatalog[] = [];
		// Type, language *and* form: one catalog identifier legitimately carries
		// several cards of the same type in different languages, and also a script
		// and a recording of the same type in the *same* language. Keying on type
		// and language alone dropped the second of those on the floor, so anything
		// asking what alternates exist under-reported them.
		const claimed = new Set<string>();
		const add = (card: CatalogCard, source: ResolvedCatalog["source"]) => {
			const key = `${card.catalog}|${card.language ?? ""}|${catalogCardForm(card)}`;
			if (claimed.has(key)) return;
			claimed.add(key);
			results.push(this.resolveCard(catalogId, card, source));
		};

		// Item-level first, which is also the precedence `getAlternative` applies.
		const itemCatalog = this.itemCatalogs.get(catalogId);
		if (itemCatalog) {
			for (const card of itemCatalog.cards) add(card, "item");
		}

		const assessmentCatalog = this.assessmentCatalogs.get(catalogId);
		if (assessmentCatalog) {
			for (const card of assessmentCatalog.cards) add(card, "assessment");
		}

		// Scoped (context-registered) alternatives resolve as "item" in
		// `getAlternative`, so report them the same way here.
		for (const [id, catalog] of this.scopedCatalogEntries()) {
			if (id !== catalogId) continue;
			for (const card of catalog.cards) add(card, "item");
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
