/**
 * Scope an external stylesheet's rules to a single player instance, so a
 * partner-authored stylesheet loaded via `<pie-item-player
 * external-style-urls="...">` or `itemConfig.resources.stylesheets[*].url`
 * styles that player's subtree instead of the whole host document.
 *
 * This replaces a single-regex implementation that prefixed every
 * selector-like fragment. That is correct for flat selector rules and wrong for
 * everything else: `@media screen { ... }` became
 * `.scope @media screen { ... }`, an invalid selector, so the browser dropped
 * the whole block and every rule inside it; `@font-face` and `@keyframes` were
 * corrupted the same way; and `:root` became `.scope :root`, which can never
 * match, because `:root` is `<html>` and is not a descendant of the player.
 * At-rules and `:root` custom properties therefore never applied at all.
 *
 * The QTI player's `scopeCssRules` (`pie-qti` -
 * `packages/item-player/src/components/utils/stylesheetRender.ts`) is not a
 * drop-in either. Its `:root` handling is the behaviour we want and is adopted
 * here, but it excludes `@` from its selector pattern rather than understanding
 * at-rules, so `@media` and `@supports` lose their condition and their inner
 * rules are hoisted and applied unconditionally — a mobile-only rule then
 * applies at every viewport width, which is a subtler failure than dropping it.
 *
 * So this walks the stylesheet brace-by-brace instead of pattern-matching it.
 * A real CSS parser would be the textbook answer and is deliberately not used:
 * `@pie-players/pie-item-player` ships with two workspace dependencies, this
 * runs in the delivery path, and scoping needs to know about rule boundaries
 * only — not about property grammar.
 *
 * Known limits, all preserving existing behaviour rather than adding policy:
 *
 * - `@import` is passed through untouched, exactly as the old regex left it. It
 *   pulls in an unscoped stylesheet, so it defeats scoping, but blocking it is
 *   a security policy decision and not this function's job. Callers gate
 *   stylesheet URLs with `validateExternalStyleUrl` before fetching.
 * - Declaration blocks are emitted verbatim, so `url(...)` references are left
 *   as authored and resolve against the stylesheet's own URL as before.
 * - A style rule's block is never rewritten, which is also what native CSS
 *   nesting needs: nested selectors are relative to a parent that has already
 *   been scoped.
 */

/**
 * At-rules whose block contains nested *rules*, so scoping has to recurse into
 * the block while the prelude is preserved verbatim.
 *
 * Everything not listed here is passed through untouched. That is the safe
 * default in both directions: at-rules whose block holds declarations rather
 * than rules (`@font-face`, `@page`, `@property`, `@counter-style`) or
 * non-selector keys (`@keyframes` percentages) must not be scoped, and an
 * at-rule this list has never heard of is more safely left alone than guessed
 * at.
 */
const NESTED_RULE_AT_RULES = new Set([
	"media",
	"supports",
	"container",
	"layer",
	"scope",
]);

/** Matches a leading `:root`, `html` or `body` not followed by more name characters. */
const DOCUMENT_ROOT_PREFIX = /^(?::root|html|body)(?![\w-])/;

/** Matches an at-rule name, with any vendor prefix, at the start of a prelude. */
const AT_RULE_NAME = /^@(?:-[a-z]+-)?([\w-]+)/i;

type StyleNode =
	/** A `;`-terminated at-rule with no block, such as `@import` or `@layer a;`. */
	| { kind: "statement"; text: string; end: number }
	/** A prelude plus a `{ ... }` block: a style rule or a block at-rule. */
	| { kind: "rule"; prelude: string; block: string; end: number }
	/** Trailing text with no rule in it, kept so nothing is silently dropped. */
	| { kind: "trailing"; text: string; end: number };

/**
 * Rewrite `cssText` so every selector it contains is confined to
 * `scopeSelector`.
 *
 * Returns `cssText` unchanged when there is no scope selector to apply, and
 * `""` for empty or non-string input.
 */
export function scopeStylesheetCss(
	cssText: unknown,
	scopeSelector: string,
): string {
	if (typeof cssText !== "string" || cssText.length === 0) return "";
	const scope = scopeSelector?.trim();
	if (!scope) return cssText;
	return scopeRuleList(stripComments(cssText), scope);
}

/**
 * Confine a single selector to `scopeSelector`.
 *
 * Exported for tests and for callers that scope a selector they built
 * themselves; `scopeStylesheetCss` is the entry point for stylesheet text.
 */
export function scopeSelector(selector: string, scopeSelector: string): string {
	const sel = selector.trim();
	const scope = scopeSelector.trim();
	if (!sel || !scope) return "";
	// Idempotent: re-scoping already-scoped CSS must not nest the scope twice.
	// Deliberately narrow — a bare `startsWith` would also skip an authored
	// selector that merely shares the scope's leading characters.
	if (sel === scope || sel.startsWith(`${scope} `)) return sel;
	// `:root`/`html`/`body` are replaced rather than prefixed. Prefixing yields
	// `.scope :root`, a selector that cannot match, which is how external
	// `:root { --var: ... }` custom properties used to disappear. Any compound
	// or combinator that followed is preserved: `html.dark .a` -> `.scope.dark .a`.
	const rootPrefix = DOCUMENT_ROOT_PREFIX.exec(sel);
	if (rootPrefix) return `${scope}${sel.slice(rootPrefix[0].length)}`;
	// Everything else becomes a descendant, including a leading pseudo-class or
	// pseudo-element. `pie-qti`'s scoper attaches those to the scope instead,
	// which is not the same selector: `:is(.a, .b) .c` authored at stylesheet
	// level means "some element matching .a or .b", so attaching it demands that
	// the *player root* carry the partner's class, and it never does. The same
	// holds for `:hover` and `::selection` — the author meant an element in the
	// content, not the player's own box. Root selectors are the one case where
	// attaching is right, and they are handled above.
	return `${scope} ${sel}`;
}

function scopeRuleList(css: string, scope: string): string {
	let out = "";
	let index = 0;
	while (index < css.length) {
		const node = readNode(css, index);
		if (node.end <= index) break;
		out += renderNode(node, scope);
		index = node.end;
	}
	return out;
}

function renderNode(node: StyleNode, scope: string): string {
	if (node.kind === "statement") {
		const text = node.text.trim();
		// A stray `;` at rule-list level carries nothing worth re-emitting.
		return text === ";" ? "" : `${text}\n`;
	}
	if (node.kind === "trailing") {
		// Only whitespace is expected here; anything else is malformed CSS that
		// is better passed through than dropped.
		return node.text.trim() ? `${node.text.trim()}\n` : "";
	}
	const prelude = node.prelude.trim();
	if (!prelude) return "";
	if (prelude.startsWith("@")) {
		const name = AT_RULE_NAME.exec(prelude)?.[1]?.toLowerCase();
		if (name && NESTED_RULE_AT_RULES.has(name)) {
			const inner = scopeRuleList(node.block, scope);
			if (!inner.trim()) return "";
			return `${prelude} {\n${inner}}\n`;
		}
		return `${prelude} {${node.block}}\n`;
	}
	const selectors = splitTopLevel(prelude, ",")
		.map((selector) => scopeSelector(selector, scope))
		.filter(Boolean);
	if (selectors.length === 0) return "";
	return `${selectors.join(", ")} {${node.block}}\n`;
}

/**
 * Read one node starting at `start`, tracking strings and parentheses so a `{`
 * inside `content: "{"` or a `,` inside `:is(a, b)` is not mistaken for
 * structure.
 */
function readNode(css: string, start: number): StyleNode {
	let index = start;
	let quote: string | null = null;
	let parenDepth = 0;
	while (index < css.length) {
		const char = css[index];
		if (quote) {
			if (char === "\\") index += 1;
			else if (char === quote) quote = null;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === "(") {
			parenDepth += 1;
		} else if (char === ")") {
			if (parenDepth > 0) parenDepth -= 1;
		} else if (parenDepth === 0 && char === ";") {
			return {
				kind: "statement",
				text: css.slice(start, index + 1),
				end: index + 1,
			};
		} else if (parenDepth === 0 && char === "{") {
			const blockEnd = findBlockEnd(css, index);
			return {
				kind: "rule",
				prelude: css.slice(start, index),
				block: css.slice(index + 1, blockEnd.contentEnd),
				end: blockEnd.end,
			};
		}
		index += 1;
	}
	return { kind: "trailing", text: css.slice(start), end: css.length };
}

/**
 * Find the `}` matching the `{` at `openIndex`. Unbalanced input (a truncated
 * stylesheet) is treated as running to the end rather than throwing.
 */
function findBlockEnd(
	css: string,
	openIndex: number,
): { contentEnd: number; end: number } {
	let depth = 0;
	let quote: string | null = null;
	for (let index = openIndex; index < css.length; index += 1) {
		const char = css[index];
		if (quote) {
			if (char === "\\") index += 1;
			else if (char === quote) quote = null;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === "{") depth += 1;
		else if (char === "}") {
			depth -= 1;
			if (depth === 0) return { contentEnd: index, end: index + 1 };
		}
	}
	return { contentEnd: css.length, end: css.length };
}

/** Split on `separator` at paren depth zero and outside strings. */
function splitTopLevel(value: string, separator: string): string[] {
	const parts: string[] = [];
	let current = "";
	let quote: string | null = null;
	let parenDepth = 0;
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index] as string;
		if (quote) {
			current += char;
			if (char === "\\" && index + 1 < value.length) {
				current += value[index + 1];
				index += 1;
			} else if (char === quote) {
				quote = null;
			}
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			current += char;
			continue;
		}
		if (char === "(") parenDepth += 1;
		else if (char === ")" && parenDepth > 0) parenDepth -= 1;
		if (char === separator && parenDepth === 0) {
			parts.push(current);
			current = "";
			continue;
		}
		current += char;
	}
	parts.push(current);
	return parts;
}

/**
 * Remove comments before walking, so a comment sitting between two rules is not
 * absorbed into the next rule's selector list. String-aware, so a literal
 * `content: "/*"` survives.
 */
function stripComments(css: string): string {
	let out = "";
	let quote: string | null = null;
	let index = 0;
	while (index < css.length) {
		const char = css[index] as string;
		if (quote) {
			out += char;
			if (char === "\\" && index + 1 < css.length) {
				out += css[index + 1];
				index += 2;
				continue;
			}
			if (char === quote) quote = null;
			index += 1;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			out += char;
			index += 1;
			continue;
		}
		if (char === "/" && css[index + 1] === "*") {
			const close = css.indexOf("*/", index + 2);
			index = close === -1 ? css.length : close + 2;
			// Keep a space so `a/**/b` does not become the single token `ab`.
			out += " ";
			continue;
		}
		out += char;
		index += 1;
	}
	return out;
}
