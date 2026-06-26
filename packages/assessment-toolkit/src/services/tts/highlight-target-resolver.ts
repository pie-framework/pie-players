export interface TTSHighlightContext {
	scopeElement?: HTMLElement | null;
	itemId?: string;
	canonicalItemId?: string;
	kind?: string;
	contentKind?: string;
	regionPolicy?: string;
}

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

export interface TTSHighlightTargetResolverRuntime {
	context: TTSHighlightContext;
	resolver?: TTSHighlightTargetResolver | null;
}

export type TTSHighlightTargetResolverProvider =
	() => TTSHighlightTargetResolverRuntime | null | undefined;
