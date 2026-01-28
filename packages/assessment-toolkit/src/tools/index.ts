/**
 * Tool system exports
 *
 * For custom elements and client-side code, use '$lib/assessment-toolkit/tools/client' instead.
 */

// Re-export everything from client.ts (client-safe code)
export * from "./client";
// Variant resolver
export { VariantResolverImpl, variantResolver } from "./variant-resolver";
