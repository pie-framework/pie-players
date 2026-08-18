/**
 * Blank out comment bodies in JS/TS/Svelte source, leaving string literals — and
 * therefore any quoted identifier a checker looks for — intact.
 *
 * A single state-tracking pass rather than a sequence of regex replaces. Ordered
 * replaces cannot do this: stripping block comments first lets a `/*` sequence that
 * appears *inside* a line comment open a phantom block comment and swallow every
 * line up to the next close. This repo's own imports made that concrete —
 * `// ... externalizes @pie-players/*, so this resolves as a bare import` hid the
 * ~700 lines that followed it from `check-capability-neutrality`. Doing line
 * comments first has the mirror-image flaw, so neither order is correct.
 *
 * Newlines are preserved so reported positions still line up with the source.
 */
export function stripComments(source) {
	let out = "";
	let i = 0;
	const n = source.length;
	const keepNewlines = (text) => text.replace(/[^\n]/g, " ");

	while (i < n) {
		const ch = source[i];
		const next = source[i + 1];

		// Line comment.
		if (ch === "/" && next === "/") {
			const end = source.indexOf("\n", i);
			const stop = end === -1 ? n : end;
			out += keepNewlines(source.slice(i, stop));
			i = stop;
			continue;
		}
		// Block comment.
		if (ch === "/" && next === "*") {
			const end = source.indexOf("*/", i + 2);
			const stop = end === -1 ? n : end + 2;
			out += keepNewlines(source.slice(i, stop));
			i = stop;
			continue;
		}
		// Markup comment (.svelte templates).
		if (source.startsWith("<!--", i)) {
			const end = source.indexOf("-->", i + 4);
			const stop = end === -1 ? n : end + 3;
			out += keepNewlines(source.slice(i, stop));
			i = stop;
			continue;
		}
		// String literal: copied through verbatim, and skipped past so a `/*` or
		// `//` inside it cannot open a comment.
		if (ch === '"' || ch === "'" || ch === "`") {
			out += ch;
			i += 1;
			while (i < n) {
				if (source[i] === "\\") {
					out += source.slice(i, i + 2);
					i += 2;
					continue;
				}
				out += source[i];
				if (source[i] === ch) {
					i += 1;
					break;
				}
				i += 1;
			}
			continue;
		}
		out += ch;
		i += 1;
	}
	return out;
}
