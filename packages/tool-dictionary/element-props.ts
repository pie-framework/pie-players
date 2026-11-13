import type { DictionaryLookup } from "./lookup.js";

/** Inputs shared by the component and its native element declaration. */
export interface DictionaryElementProps {
	visible?: boolean;
	toolId?: string;
	term?: string;
	/**
	 * Identity of the current `term`, changing once per time it was asked for.
	 *
	 * Optional: a host assigning `term` directly need not mint one, and the panel
	 * falls back to the term itself. What it buys is a learner selecting the same
	 * word twice — a second request for `cat` has a new id, so it re-runs, where an
	 * unchanged `term` alone looks like a re-render.
	 */
	termRequestId?: string | number;
	endpoint?: string;
	language?: string;
	/**
	 * Host-supplied resolver, preferred over `endpoint`. A property rather than an
	 * attribute because it is a function; a host with its own client passes it
	 * directly instead of routing through HTTP shaping this package guessed at.
	 */
	lookup?: DictionaryLookup;
	/**
	 * Extra request headers for the `endpoint` path, read per request so a
	 * short-lived token is fetched fresh rather than captured at mount.
	 *
	 * Only for a host whose route is not authorised by the assessment's own session:
	 * the endpoint is called `same-origin` by default, so a route behind that session
	 * needs nothing here.
	 */
	headers?: () => Promise<Record<string, string>> | Record<string, string>;
	/** Overrides the `same-origin` default for the `endpoint` path. */
	credentials?: RequestCredentials;
}
