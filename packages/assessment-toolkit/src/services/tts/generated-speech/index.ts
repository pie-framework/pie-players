/**
 * Generated-speech module (PIE-623): runtime speech composition for math items
 * that ship without authored SSML / `accessibilityCatalogs`.
 *
 * Layering:
 *   - Pure core (`./assemble-plan`, `./math-speech-cache`, `./types`): no DOM
 *     walking, no runtime/Svelte imports. Enforced by
 *     `scripts/check-speech-composition-purity.mjs`.
 *   - DOM adapter (`./dom/*`): binds the plan to live DOM and emits playback
 *     chunks for `TTSService`.
 */

export * from "./types.js";
export { assembleGeneratedSpeech, type MathSpeechResolver } from "./assemble-plan.js";
export {
	createMemoizedMathSpeechResolver,
	type MathSpeechCacheOptions,
} from "./math-speech-cache.js";
export {
	buildGeneratedSpeechFromRoot,
	type BuildGeneratedSpeechResult,
} from "./dom/build-dom-plan.js";
export { planToCompositionChunkInputs } from "./dom/to-chunk-inputs.js";
export type { DomAnchor, GeneratedSpeechChunk } from "./dom/types.js";
