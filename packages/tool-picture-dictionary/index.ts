/**
 * pie-tool-picture-dictionary - PIE Assessment Tool
 *
 * Importing this package registers `<pie-tool-picture-dictionary>`. The build entry is
 * the component, so this file carries types only — a runtime export here would not
 * exist in the built bundle.
 *
 * The lookup contract is public because a host supplies the resolver: the symbol corpus
 * behind a picture dictionary is licensed, so PIE ships no endpoint. Set the `endpoint`
 * attribute for the built-in POST shaping, or assign the element's `lookup` property to
 * use a client of your own.
 */

import type { PictureDictionaryElementProps } from "./element-props.js";

/** Native host interface for `<pie-tool-picture-dictionary>`. Properties may be unset until it mounts. */
export interface PieToolPictureDictionaryElement extends HTMLElement, PictureDictionaryElementProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-picture-dictionary": PieToolPictureDictionaryElement;
	}
}

export type {
	PictureLookup,
	PictureLookupRequest,
	PictureLookupResult,
	PictureResult,
} from "./lookup.js";
