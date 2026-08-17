/**
 * pie-tool-dictionary - PIE Assessment Tool
 *
 * Importing this package registers `<pie-tool-dictionary>`. The build entry is the
 * component, so this file carries types only — a runtime export here would not exist
 * in the built bundle.
 *
 * The lookup contract is public because a host supplies the resolver: PIE ships no
 * dictionary endpoint, since the corpus behind one is licensed per programme. Set the
 * `endpoint` attribute for the built-in POST shaping, or assign the element's `lookup`
 * property to use a client of your own.
 */

export type {
	DictionaryEntry,
	DictionaryLookup,
	DictionaryLookupRequest,
	DictionaryLookupResult,
	DictionarySense,
} from "./lookup.js";
