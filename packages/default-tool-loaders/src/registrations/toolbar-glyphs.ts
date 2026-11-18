/**
 * The FontAwesome glyph for each built-in toolbar icon name.
 *
 * A button whose definition carries `faIconName` renders as
 * `<pie-nds-icon-button>` where the host enables NDS icons; one without it keeps
 * the toolbar's square button. Every packaged registration's button takes its
 * glyph from here, through the icon name it already declares, so under NDS the
 * whole toolbar is one kind of button. A registration that names a new icon adds
 * its glyph here in the same change, which
 * `tests/packaged-capability-composition.test.ts` enforces.
 *
 * Keyed by the same generic shape names the toolkit's built-in markup uses
 * (`resolveFallbackToolIcon`). Values are FontAwesome 6 names the Free set
 * carries in Solid, which is what the NDS glyphs fall back to on a page without
 * FA Pro (see players-shared `ui/fontawesome`).
 */
const TOOLBAR_FA_GLYPHS: Readonly<Record<string, string>> = {
	"bars-3": "glasses",
	beaker: "flask",
	"book-open": "book-open",
	calculator: "calculator",
	"chart-bar": "chart-bar",
	highlighter: "highlighter",
	"magnifying-glass": "magnifying-glass-plus",
	photo: "image",
	// FontAwesome has no protractor; the drafting compass is the nearest
	// geometry instrument it draws.
	protractor: "compass-drafting",
	ruler: "ruler",
	strikethrough: "strikethrough",
	swatch: "palette",
	"volume-up": "volume-high",
};

/** The FontAwesome glyph for toolbar icon `icon`, or `undefined` when none is mapped. */
export function resolveToolbarFaGlyph(
	icon: string | undefined,
): string | undefined {
	return icon ? TOOLBAR_FA_GLYPHS[icon] : undefined;
}
