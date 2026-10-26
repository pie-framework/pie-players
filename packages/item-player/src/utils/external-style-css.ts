import { validateExternalStyleUrl } from "@pie-players/pie-players-shared/security";

export type ExternalStyleCssResult =
	| { ok: true; cssText: string }
	| { ok: false; message: string };

export interface ExternalStyleCssOptions {
	/** The fetched stylesheet URL used as the base for relative resources. */
	stylesheetUrl: string;
	/** The embedding document URL used to determine the default same origin. */
	documentUrl: string;
	allowedOrigins?: string[];
}

/**
 * Return a URL suitable for diagnostics without exposing credentials, query
 * parameters, or fragments that may contain signed-resource tokens.
 */
export function describeExternalStyleUrl(
	value: string,
	baseUrl: string,
): string {
	try {
		const parsed = new URL(value, baseUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
			return "(invalid stylesheet URL)";
		return `${parsed.origin}${parsed.pathname}`;
	} catch {
		return "(invalid stylesheet URL)";
	}
}

const isHexDigit = (value: string) => /^[0-9a-f]$/i.test(value);
const isIdentifierCharacter = (value: string) =>
	/[a-z0-9_-]/i.test(value) || value.charCodeAt(0) >= 0x80;

/** Decode the subset of CSS escapes relevant to identifiers and URL values. */
const decodeCssEscapes = (value: string): string => {
	let decoded = "";
	for (let index = 0; index < value.length; index += 1) {
		const current = value[index];
		if (current !== "\\") {
			decoded += current;
			continue;
		}

		const next = value[index + 1];
		if (next === undefined) {
			decoded += "\uFFFD";
			continue;
		}
		if (next === "\n" || next === "\f") {
			index += 1;
			continue;
		}
		if (next === "\r") {
			index += value[index + 2] === "\n" ? 2 : 1;
			continue;
		}
		if (isHexDigit(next)) {
			let hex = "";
			let cursor = index + 1;
			while (
				cursor < value.length &&
				hex.length < 6 &&
				isHexDigit(value[cursor])
			) {
				hex += value[cursor];
				cursor += 1;
			}
			if (/\s/.test(value[cursor] ?? "")) cursor += 1;
			const codePoint = Number.parseInt(hex, 16);
			decoded +=
				codePoint === 0 || codePoint > 0x10ffff
					? "\uFFFD"
					: String.fromCodePoint(codePoint);
			index = cursor - 1;
			continue;
		}

		decoded += next;
		index += 1;
	}
	return decoded;
};

const readIdentifier = (cssText: string, start: number) => {
	let end = start;
	while (end < cssText.length) {
		const current = cssText[end];
		if (isIdentifierCharacter(current)) {
			end += 1;
			continue;
		}
		if (current !== "\\" || end + 1 >= cssText.length) break;
		end += 2;
		if (isHexDigit(cssText[end - 1])) {
			let hexDigits = 1;
			while (
				end < cssText.length &&
				hexDigits < 6 &&
				isHexDigit(cssText[end])
			) {
				end += 1;
				hexDigits += 1;
			}
			if (/\s/.test(cssText[end] ?? "")) end += 1;
		}
	}
	return {
		end,
		decoded: decodeCssEscapes(cssText.slice(start, end)),
	};
};

const readString = (cssText: string, start: number) => {
	const quote = cssText[start];
	let end = start + 1;
	while (end < cssText.length) {
		if (cssText[end] === "\\") {
			end += 2;
			continue;
		}
		if (cssText[end] === quote) {
			return { end: end + 1, closed: true };
		}
		end += 1;
	}
	return { end, closed: false };
};

const skipWhitespaceAndComments = (cssText: string, start: number): number => {
	let end = start;
	while (end < cssText.length) {
		if (/\s/.test(cssText[end])) {
			end += 1;
			continue;
		}
		if (cssText.startsWith("/*", end)) {
			const commentEnd = cssText.indexOf("*/", end + 2);
			return commentEnd === -1
				? cssText.length
				: skipWhitespaceAndComments(cssText, commentEnd + 2);
		}
		break;
	}
	return end;
};

const escapeCssString = (value: string) =>
	value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ");

/**
 * Inspect fetched CSS before it is injected into the page.
 *
 * Imports are rejected instead of recursively fetching an unbounded stylesheet
 * graph. Every url() reference is resolved relative to the final stylesheet URL,
 * checked against the document's same-origin/allow-list policy, and rewritten to
 * an absolute URL so inline injection cannot change its base URL.
 */
export function prepareExternalStyleCss(
	cssText: string,
	options: ExternalStyleCssOptions,
): ExternalStyleCssResult {
	let output = "";
	let cursor = 0;

	while (cursor < cssText.length) {
		if (cssText.startsWith("/*", cursor)) {
			const commentEnd = cssText.indexOf("*/", cursor + 2);
			if (commentEnd === -1) {
				return {
					ok: false,
					message: "Stylesheet contains an unclosed comment.",
				};
			}
			output += cssText.slice(cursor, commentEnd + 2);
			cursor = commentEnd + 2;
			continue;
		}

		if (cssText[cursor] === '"' || cssText[cursor] === "'") {
			const string = readString(cssText, cursor);
			if (!string.closed) {
				return {
					ok: false,
					message: "Stylesheet contains an unclosed string.",
				};
			}
			output += cssText.slice(cursor, string.end);
			cursor = string.end;
			continue;
		}

		if (cssText[cursor] === "@") {
			const identifier = readIdentifier(cssText, cursor + 1);
			if (identifier.decoded.toLowerCase() === "import") {
				return {
					ok: false,
					message: "Stylesheet @import rules are not allowed.",
				};
			}
			output += cssText.slice(cursor, identifier.end);
			cursor = identifier.end;
			continue;
		}

		if (isIdentifierCharacter(cssText[cursor]) || cssText[cursor] === "\\") {
			const identifier = readIdentifier(cssText, cursor);
			const functionStart = skipWhitespaceAndComments(cssText, identifier.end);
			const functionName = identifier.decoded.toLowerCase();
			if (
				(functionName === "image-set" ||
					functionName === "-webkit-image-set") &&
				cssText[functionStart] === "("
			) {
				return {
					ok: false,
					message: "Stylesheet image-set() functions are not allowed.",
				};
			}
			if (functionName !== "url" || cssText[functionStart] !== "(") {
				output += cssText.slice(cursor, identifier.end);
				cursor = identifier.end;
				continue;
			}

			let valueStart = functionStart + 1;
			while (/\s/.test(cssText[valueStart] ?? "")) valueStart += 1;
			let valueEnd = valueStart;
			let rawValue = "";
			if (cssText[valueStart] === '"' || cssText[valueStart] === "'") {
				const string = readString(cssText, valueStart);
				if (!string.closed) {
					return {
						ok: false,
						message: "Stylesheet contains an invalid url().",
					};
				}
				rawValue = cssText.slice(valueStart + 1, string.end - 1);
				valueEnd = skipWhitespaceAndComments(cssText, string.end);
			} else {
				while (valueEnd < cssText.length && cssText[valueEnd] !== ")") {
					if (cssText[valueEnd] === "(" || cssText.startsWith("/*", valueEnd)) {
						return {
							ok: false,
							message: "Stylesheet contains a dynamic or malformed url().",
						};
					}
					if (cssText[valueEnd] === "\\") valueEnd += 1;
					valueEnd += 1;
				}
				rawValue = cssText.slice(valueStart, valueEnd).trim();
			}

			if (cssText[valueEnd] !== ")") {
				return { ok: false, message: "Stylesheet contains an invalid url()." };
			}

			const decodedValue = decodeCssEscapes(rawValue).trim();
			if (decodedValue.length === 0) {
				return { ok: false, message: "Stylesheet contains an empty url()." };
			}
			if (decodedValue.startsWith("#")) {
				output += cssText.slice(cursor, valueEnd + 1);
				cursor = valueEnd + 1;
				continue;
			}

			let absoluteUrl: string;
			try {
				absoluteUrl = new URL(decodedValue, options.stylesheetUrl).toString();
			} catch {
				return { ok: false, message: "Stylesheet contains an invalid url()." };
			}
			const validation = validateExternalStyleUrl(absoluteUrl, {
				baseUrl: options.documentUrl,
				allowedOrigins: options.allowedOrigins,
			});
			if (!validation.ok) {
				return {
					ok: false,
					message: `Stylesheet resource URL is not allowed: ${validation.message}`,
				};
			}

			output += `url("${escapeCssString(validation.resolvedUrl.toString())}")`;
			cursor = valueEnd + 1;
			continue;
		}

		output += cssText[cursor];
		cursor += 1;
	}

	return { ok: true, cssText: output };
}
