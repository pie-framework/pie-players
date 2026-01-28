import type { AccessibilityCatalog, CatalogCard } from '@pie-players/pie-players-shared/types';

/**
 * Supported accessibility catalog types from QTI 3.0 / APIP
 */
export type CatalogType =
  | 'spoken'              // Text-to-speech scripts
  | 'sign-language'       // Video URLs for signed content
  | 'braille'             // Braille transcriptions
  | 'tactile'             // Tactile graphics descriptions
  | 'simplified-language' // Plain language alternatives
  | 'audio-description'   // Extended audio descriptions
  | 'extended-description' // Extended text descriptions
  | string;               // Support custom types

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
  /** The content (HTML, URL, or plain text) */
  content: string;
  /** Source of the catalog (assessment or item) */
  source: 'assessment' | 'item';
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
  private defaultLanguage: string = 'en';

  constructor(
    assessmentCatalogs?: AccessibilityCatalog[],
    defaultLanguage: string = 'en'
  ) {
    this.defaultLanguage = defaultLanguage;
    this.indexCatalogs(assessmentCatalogs ?? [], 'assessment');
  }

  /**
   * Set the default language for fallback resolution
   */
  setDefaultLanguage(language: string): void {
    this.defaultLanguage = language;
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
    source: 'assessment' | 'item'
  ): void {
    const targetMap = source === 'assessment' ? this.assessmentCatalogs : this.itemCatalogs;

    for (const catalog of catalogs) {
      targetMap.set(catalog.identifier, catalog);
    }
  }

  /**
   * Add item-level catalogs (called when rendering a new item)
   */
  addItemCatalogs(catalogs?: AccessibilityCatalog[]): void {
    if (!catalogs || catalogs.length === 0) return;
    this.indexCatalogs(catalogs, 'item');
  }

  /**
   * Clear item-level catalogs (called when leaving an item)
   */
  clearItemCatalogs(): void {
    this.itemCatalogs.clear();
  }

  /**
   * Check if a catalog exists (checks both assessment and item levels)
   */
  hasCatalog(catalogId: string): boolean {
    return this.itemCatalogs.has(catalogId) || this.assessmentCatalogs.has(catalogId);
  }

  /**
   * Get alternative content for a catalog identifier
   *
   * Priority: Item-level catalogs take precedence over assessment-level
   */
  getAlternative(
    catalogId: string,
    options: CatalogLookupOptions
  ): ResolvedCatalog | null {
    // Check item-level first (higher precedence)
    const itemCatalog = this.itemCatalogs.get(catalogId);
    if (itemCatalog) {
      const card = this.findMatchingCard(itemCatalog, options);
      if (card) {
        return {
          catalogId,
          type: card.catalog,
          language: card.language,
          content: card.content,
          source: 'item'
        };
      }
    }

    // Fallback to assessment-level
    const assessmentCatalog = this.assessmentCatalogs.get(catalogId);
    if (assessmentCatalog) {
      const card = this.findMatchingCard(assessmentCatalog, options);
      if (card) {
        return {
          catalogId,
          type: card.catalog,
          language: card.language,
          content: card.content,
          source: 'assessment'
        };
      }
    }

    return null;
  }

  /**
   * Find a matching catalog card based on lookup options
   */
  private findMatchingCard(
    catalog: AccessibilityCatalog,
    options: CatalogLookupOptions
  ): CatalogCard | null {
    const { type, language, useFallback = true } = options;

    // Try exact match (type + language)
    if (language) {
      const exactMatch = catalog.cards.find(
        card => card.catalog === type && card.language === language
      );
      if (exactMatch) return exactMatch;
    }

    // Try type match with default language (if fallback enabled)
    if (useFallback) {
      const defaultMatch = catalog.cards.find(
        card => card.catalog === type && card.language === this.defaultLanguage
      );
      if (defaultMatch) return defaultMatch;

      // Try type match without language constraint
      const typeMatch = catalog.cards.find(card => card.catalog === type);
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
          source: 'item'
        });
      }
    }

    // Add assessment-level alternatives (if not already provided by item)
    const assessmentCatalog = this.assessmentCatalogs.get(catalogId);
    if (assessmentCatalog) {
      for (const card of assessmentCatalog.cards) {
        // Only add if not already provided by item catalog
        const exists = results.some(
          r => r.type === card.catalog && r.language === card.language
        );
        if (!exists) {
          results.push({
            catalogId,
            type: card.catalog,
            language: card.language,
            content: card.content,
            source: 'assessment'
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
    const itemIds = Array.from(this.itemCatalogs.keys());
    const assessmentIds = Array.from(this.assessmentCatalogs.keys());

    // Combine and deduplicate
    return Array.from(new Set([...itemIds, ...assessmentIds]));
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
      totalCatalogs: this.assessmentCatalogs.size + this.itemCatalogs.size,
      assessmentCatalogs: this.assessmentCatalogs.size,
      itemCatalogs: this.itemCatalogs.size,
      availableTypes: allTypes,
      availableLanguages: allLanguages
    };
  }

  /**
   * Check if a specific catalog type is available for a given catalog ID
   */
  hasAlternativeType(catalogId: string, type: CatalogType): boolean {
    const alternatives = this.getAllAlternatives(catalogId);
    return alternatives.some(alt => alt.type === type);
  }

  /**
   * Get all catalog IDs that have a specific type of alternative
   */
  getCatalogsByType(type: CatalogType): string[] {
    const catalogIds = new Set<string>();

    for (const [id, catalog] of this.assessmentCatalogs.entries()) {
      if (catalog.cards.some(card => card.catalog === type)) {
        catalogIds.add(id);
      }
    }

    for (const [id, catalog] of this.itemCatalogs.entries()) {
      if (catalog.cards.some(card => card.catalog === type)) {
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
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.reset();
  }
}
