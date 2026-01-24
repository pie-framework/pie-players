/**
 * Tool system exports
 *
 * This is the full export including server-side services (accommodationResolver, variantResolver).
 * For custom elements and client-side code, use '$lib/assessment-toolkit/tools/client' instead.
 */

// Server-side services (only used by PIEOneer backend, not by custom elements)
// Deprecated singleton exports (kept for backward compatibility)
// @deprecated Instantiate AccommodationResolverImpl directly instead
export {
	AccommodationResolverImpl,
	accommodationResolver,
} from "./accommodation-resolver";
// Re-export everything from client.ts (client-safe code)
export * from "./client";
// @deprecated Instantiate VariantResolverImpl directly instead
export { VariantResolverImpl, variantResolver } from "./variant-resolver";
