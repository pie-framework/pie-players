/**
 * Stub picture corpus for the demos.
 *
 * Glyphs rather than a licensed symbol set: the point is to exercise the tool's
 * rendering and its URL-safety filter, not to be a picture dictionary.
 */

export interface StubPicture {
	caption: string;
	glyph: string;
}

export const PICTURES: Record<string, StubPicture[]> = {
	apple: [{ caption: "An apple", glyph: "🍎" }],
	sun: [
		{ caption: "The sun", glyph: "☀️" },
		{ caption: "Sunrise", glyph: "🌅" },
	],
	leaf: [{ caption: "A leaf", glyph: "🍃" }],
	water: [{ caption: "Water", glyph: "💧" }],
};

/** Resolve a `<keyword>-<index>` glyph slug back to its picture. */
export function findPicture(slug: string): StubPicture | null {
	const match = /^(.*)-(\d+)$/u.exec(slug);
	if (!match) return null;
	const [, keyword, rawIndex] = match;
	return PICTURES[keyword.toLowerCase()]?.[Number(rawIndex)] ?? null;
}
