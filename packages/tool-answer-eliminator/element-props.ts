/**
 * Store key per PIE element, by the element's model id (which is also its DOM
 * id). A choice persists under the key of the nearest ancestor listed here.
 */
export type ElementStateKeys = Readonly<Record<string, string>>;

/** Inputs shared by the component and its native element declaration. */
export interface AnswerEliminatorProps {
	visible?: boolean;
	/**
	 * How an eliminated choice is painted: `strikethrough` strikes its text and
	 * crosses out its images and math, `cross` draws an X over block content and
	 * a line through inline content, and `mask` dims and blurs it.
	 */
	strategy?: 'strikethrough' | 'cross' | 'mask';
	alwaysOn?: boolean;
	elementStateKeys?: ElementStateKeys;
	/**
	 * Model ids of the PIE elements whose choices take a toggle. Unset, every
	 * element's choices do.
	 */
	elementIds?: readonly string[];
}

export type EliminationStrategyName = NonNullable<AnswerEliminatorProps['strategy']>;
