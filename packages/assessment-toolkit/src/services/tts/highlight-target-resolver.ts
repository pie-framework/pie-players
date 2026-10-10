/**
 * What the host knows about the content being highlighted. `scopeElement`
 * falls back to the content element being read.
 */
export interface TTSHighlightContext {
	scopeElement?: HTMLElement | null;
	itemId?: string;
	canonicalItemId?: string;
	kind?: string;
	contentKind?: string;
	regionPolicy?: string;
}

/**
 * Host remap of TTS highlight targets. A null or undefined result keeps the
 * native targets, and so does a result outside `scopeElement` or a throw. For
 * sentences, one out-of-scope or non-Range/Element entry keeps all native
 * ranges.
 */
export interface TTSHighlightTargetResolver {
	resolveWordRange?(
		range: Range,
		context: TTSHighlightContext,
	): Range | null | undefined;
	resolveSentenceRanges?(
		ranges: Range[],
		context: TTSHighlightContext,
	): Array<Range | HTMLElement> | null | undefined;
}

/** A resolver with the context it is called with. */
export interface TTSHighlightTargetResolverRuntime {
	context: TTSHighlightContext;
	resolver?: TTSHighlightTargetResolver | null;
}

/** Read at every highlight; a throw counts as no resolver. */
export type TTSHighlightTargetResolverProvider = () =>
	| TTSHighlightTargetResolverRuntime
	| null
	| undefined;
