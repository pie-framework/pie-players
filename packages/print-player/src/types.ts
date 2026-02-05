/**
 * Type definitions for PIE Print Player
 */

/**
 * Map of element tag names to package names with versions
 * @example { 'multiple-choice': '@pie-element/multiple-choice@12.0.0' }
 */
export type Elements = Record<string, string>;

/**
 * PIE element model with required fields
 */
export interface Model {
  /** Unique identifier for this element instance */
  id: string;
  /** Element tag name (e.g., 'multiple-choice') */
  element: string;
  /** Additional model properties specific to each element type */
  [key: string]: any;
}

/**
 * PIE item configuration containing markup, elements, and models
 */
export interface Item {
  /** HTML markup containing element placeholders */
  markup: string;
  /** Map of element tag names to package identifiers */
  elements: Elements;
  /** Array of element models to be rendered */
  models: Model[];
}

/**
 * Configuration for the print player
 */
export interface Config {
  /** Item to render */
  item: Item;
  /** Optional rendering options */
  options?: {
    /** Role for rendering (affects answer visibility) */
    role?: 'student' | 'instructor';
    /** Legacy mode property (converted from role) */
    mode?: 'student' | 'instructor';
  };
}

/**
 * Package resolution result
 */
export interface PkgResolution {
  /** Original element tag name */
  tagName: string;
  /** Print-specific tag name (with hash suffix) */
  printTagName?: string;
  /** Package identifier (e.g., '@pie-element/multiple-choice@12.0.0') */
  pkg: string;
  /** URL to load the print module from */
  url: string;
  /** Whether to load as ES module */
  module: boolean;
}

/**
 * Function type for resolving package URLs
 */
export type ResolverFn = (tagName: string, pkg: string) => Promise<PkgResolution>;

/**
 * Function type for loading resolved packages
 */
export type LoadResolutionFn = (r: PkgResolution) => Promise<LoadResolutionResult>;

/**
 * Result of loading a package resolution
 */
export interface LoadResolutionResult {
  /** Whether the load was successful */
  success: boolean;
  /** The package resolution that was loaded */
  pkg: PkgResolution;
  /** Error message if load failed */
  message?: string;
}

/**
 * Function type for creating missing element placeholders
 */
export type MissingElFn = (pkg: PkgResolution, message?: string) => CustomElementConstructor;

/**
 * Node result from markup processing
 */
export interface NodeResult {
  /** Element ID */
  id: string;
  /** PIE element ID (may differ from id) */
  pieId?: string | null;
  /** Original tag name before transformation */
  originalTag?: string | null;
  [key: string]: string | null | undefined;
}
