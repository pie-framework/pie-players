/**
 * Store key per PIE element, by the element's model id (which is also its DOM
 * id). A choice persists under the key of the nearest ancestor listed here.
 */
export type ElementStateKeys = Readonly<Record<string, string>>;

/** Inputs shared by the component and its native element declaration. */
export interface AnswerEliminatorProps {
	visible?: boolean;
	strategy?: 'strikethrough' | 'mask';
	alwaysOn?: boolean;
	buttonAlignment?: 'start' | 'end' | 'inline' | 'left' | 'right';
	elementStateKeys?: ElementStateKeys;
}
