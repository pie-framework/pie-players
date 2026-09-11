/**
 * Shared DOMPurify forbid-lists for every in-repo sanitizer (item/passage
 * markup, SVG icons). Keeping one canonical list means a newly-identified
 * dangerous tag or attribute only needs to be added once to cover every
 * sanitizer instead of drifting between hand-maintained copies.
 */

export const SANITIZER_FORBIDDEN_TAGS = [
	"script",
	"iframe",
	"object",
	"embed",
	"base",
	"form",
	"meta",
	"link",
	// A <style> element is a document-global stylesheet. The item player renders
	// in light DOM (`shadow: "none"`), so a <style> in authored markup restyles
	// host chrome outside the item. DOMPurify's defaults already drop a
	// top-level HTML <style>; the SVG profile keeps one, whose rules apply
	// document-wide all the same — verified in Chromium 2026-08-30, where
	// `<svg><style>` passed this list and hid an element outside the player.
	// `style` is in DOMPurify's default FORBID_CONTENTS, so the CSS text is
	// dropped with the tag rather than surfacing as item text.
	"style",
	// <foreignObject> inside an <svg> is a well-known escape hatch back into
	// HTML context.
	"foreignobject",
];

// DOMPurify already strips `on*` handlers via its default block-list; these
// entries guarantee they stay stripped even if a consumer tweaks defaults,
// and they cover the common SVG / math sinks.
export const SANITIZER_FORBIDDEN_ATTRS = [
	"onerror",
	"onload",
	"onclick",
	"onmouseover",
	"onmouseout",
	"onmouseenter",
	"onmouseleave",
	"onfocus",
	"onblur",
	"onkeydown",
	"onkeyup",
	"onkeypress",
	"onsubmit",
	"onchange",
	"onbeforeunload",
	"formaction",
	"xlink:href",
];
