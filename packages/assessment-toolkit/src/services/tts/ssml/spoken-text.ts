import { normalizeTextForSpeech } from "../text-processing.js";

/**
 * Shared SSML → spoken-text extractor.
 *
 * Strips SSML markup to the words a TTS engine would actually voice, while
 * recording a `rawToSpokenOffsetMap` from raw-SSML character offsets to
 * normalized spoken-text offsets. This is the single source of truth for SSML
 * stripping used by:
 *   - the catalog span aligner (`catalog-span-alignment.ts`),
 *   - the math speech tokenizer (`math-alignment/speech-tokenizer.ts`),
 *   - the runtime generated-speech path (PIE-623).
 *
 * Keeping one implementation guarantees provider word-boundary offsets (which
 * are into the raw SSML string) map to the same spoken text on every path.
 *
 * Tag handling:
 *   - Structural tags (`speak`, `p`, `s`, `emphasis`, `prosody`, `say-as`,
 *     `voice`, `lang`) are transparent; their text content flows through.
 *     `p`/`s` open tags inject a word boundary space.
 *   - `break` injects a space (a pause is a word boundary).
 *   - `sub alias="…"` substitutes the alias text (and skips the original).
 *     `sub` with no alias marks the content unsupported for word tracking.
 *   - Semantic tags that change *what* is spoken without leaving trackable
 *     text (`audio`, `phoneme`) mark the content unsupported.
 *   - Any other unknown element marks the content unsupported (degrade to
 *     coarse region highlighting rather than mis-track).
 */
export interface ExtractedSpokenText {
	spokenText: string;
	rawToSpokenOffsetMap: Map<number, number>;
	unsupportedSemantic: boolean;
	hasMarkup: boolean;
}

interface SourceChar {
	char: string;
	rawOffset: number | null;
}

const STRUCTURAL_SSML_TAGS = new Set([
	"speak",
	"p",
	"s",
	"emphasis",
	"prosody",
	"say-as",
	"voice",
	"lang",
]);

const UNSUPPORTED_SEMANTIC_SSML_TAGS = new Set(["audio", "phoneme"]);

const decodeXmlEntities = (value: string): string =>
	value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, "\u00a0")
		.replace(/&#160;/g, "\u00a0")
		.replace(/&amp;/g, "&");

const appendSourceText = (
	chars: SourceChar[],
	value: string,
	rawOffset: number | null,
): void => {
	for (let i = 0; i < value.length; i++) {
		chars.push({
			char: value[i],
			rawOffset: rawOffset === null ? null : rawOffset + i,
		});
	}
};

const appendSpace = (chars: SourceChar[]): void => {
	chars.push({ char: " ", rawOffset: null });
};

const normalizeSourceChars = (
	chars: SourceChar[],
): { text: string; rawToSpokenOffsetMap: Map<number, number> } => {
	const rawToSpokenOffsetMap = new Map<number, number>();
	const out: string[] = [];
	let lastWasWhitespace = true;

	for (const sourceChar of chars) {
		const isWhitespace = /\s/.test(sourceChar.char);
		if (isWhitespace) {
			if (!lastWasWhitespace && out.length > 0) {
				out.push(" ");
				if (sourceChar.rawOffset !== null) {
					rawToSpokenOffsetMap.set(sourceChar.rawOffset, out.length - 1);
				}
			}
			lastWasWhitespace = true;
			continue;
		}
		out.push(sourceChar.char);
		if (sourceChar.rawOffset !== null) {
			rawToSpokenOffsetMap.set(sourceChar.rawOffset, out.length - 1);
		}
		lastWasWhitespace = false;
	}

	while (out.length > 0 && out[out.length - 1] === " ") {
		out.pop();
	}

	// Drop any raw→spoken entries that now point past the trimmed end; otherwise
	// a boundary at a trailing space would map to an out-of-range spoken offset.
	for (const [rawOffset, spokenOffset] of rawToSpokenOffsetMap) {
		if (spokenOffset >= out.length) rawToSpokenOffsetMap.delete(rawOffset);
	}

	return { text: out.join(""), rawToSpokenOffsetMap };
};

const getTagName = (tagSource: string): string => {
	const match = tagSource.match(/^<\/?\s*([A-Za-z0-9:-]+)/);
	return match?.[1]?.toLowerCase() || "";
};

const getAttribute = (tagSource: string, name: string): string | null => {
	const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
	const match = tagSource.match(pattern);
	return decodeXmlEntities(match?.[2] ?? match?.[3] ?? "") || null;
};

export const extractSpokenText = (speechText: string): ExtractedSpokenText => {
	const sourceChars: SourceChar[] = [];
	let unsupportedSemantic = false;
	let hasMarkup = false;
	let index = 0;

	while (index < speechText.length) {
		const char = speechText[index];
		if (char !== "<") {
			appendSourceText(sourceChars, char, index);
			index++;
			continue;
		}

		const closeIndex = speechText.indexOf(">", index + 1);
		if (closeIndex < 0) {
			appendSourceText(sourceChars, char, index);
			index++;
			continue;
		}

		hasMarkup = true;
		const tagSource = speechText.slice(index, closeIndex + 1);
		const tagName = getTagName(tagSource);
		const isClosing = /^<\s*\//.test(tagSource);
		const isSelfClosing = /\/\s*>$/.test(tagSource);

		if (!isClosing && tagName === "sub") {
			const alias = getAttribute(tagSource, "alias");
			if (!alias) {
				unsupportedSemantic = true;
				index = closeIndex + 1;
				continue;
			}
			appendSourceText(sourceChars, alias, null);
			const closingSub = speechText
				.toLowerCase()
				.indexOf("</sub>", closeIndex + 1);
			index = closingSub >= 0 ? closingSub + "</sub>".length : closeIndex + 1;
			continue;
		}

		if (!isClosing && tagName === "break") {
			appendSpace(sourceChars);
			index = closeIndex + 1;
			continue;
		}

		if (!isClosing && UNSUPPORTED_SEMANTIC_SSML_TAGS.has(tagName)) {
			unsupportedSemantic = true;
			if (isSelfClosing) {
				index = closeIndex + 1;
				continue;
			}
		}

		if (
			tagName &&
			!STRUCTURAL_SSML_TAGS.has(tagName) &&
			!UNSUPPORTED_SEMANTIC_SSML_TAGS.has(tagName) &&
			tagName !== "break" &&
			tagName !== "sub"
		) {
			unsupportedSemantic = true;
		}

		if (!isClosing && (tagName === "p" || tagName === "s")) {
			appendSpace(sourceChars);
		}
		index = closeIndex + 1;
	}

	const normalized = normalizeSourceChars(sourceChars);
	return {
		spokenText: normalizeTextForSpeech(normalized.text),
		rawToSpokenOffsetMap: normalized.rawToSpokenOffsetMap,
		unsupportedSemantic,
		hasMarkup,
	};
};
