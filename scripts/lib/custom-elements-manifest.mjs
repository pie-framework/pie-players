/**
 * Custom Elements Manifest (schema 2.1.0) for each publishable package, read
 * from source syntax alone.
 *
 * Registration: each package export's static runtime import graph is followed
 * from its source file. A `.svelte` file whose `customElement` option names a
 * tag registers it, and so does a top-level call to a function whose name
 * contains "define", given a tag and a constructor that resolve statically, or
 * a top-level call to a function whose body makes such a call with its
 * parameters (`definePieTheme()`, `definePieItemPlayer()`).
 *
 * Surface: attributes, properties and methods come from the code, following
 * the runtime rules of Svelte custom elements and Lit. A Svelte element's
 * description, events, slots and parts come from its `<!-- @component -->`
 * comment, a class's from its JSDoc, using `@fires {Type} name - text`,
 * `@slot [name] - text` and `@csspart name - text`. The markup is checked
 * against the documented slots and parts, and every event dispatched under a
 * static name from the files the element renders, up to the next element,
 * must be documented. CSS custom properties come from the theme's token
 * registry, so `@cssprop` is rejected.
 *
 * The `x-pie` extension on each declaration records whether the element
 * renders into an open shadow root or its light DOM, and for a light-DOM
 * element the static `pie-*` classes its own templates render, which are the
 * styling hooks a host may target.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseSvelte } from "svelte/compiler";
import ts from "typescript";
import {
	REPO_ROOT,
	workspaceExports,
	workspacePackages,
} from "../../test-support/workspace-sources.ts";
import { moduleExports, resolveRelative } from "./api-exports.mjs";

export const SCHEMA_VERSION = "2.1.0";
export const MANIFEST_FILE = "custom-elements.json";
const TOKEN_REGISTRY = "packages/theme/src/token-registry.json";
const THEME_PACKAGE = "@pie-players/pie-theme";

const LIFECYCLE_MEMBERS = new Set([
	"constructor",
	"connectedCallback",
	"disconnectedCallback",
	"adoptedCallback",
	"attributeChangedCallback",
	"connectedMoveCallback",
	// Lit's reactive update cycle.
	"createRenderRoot",
	"render",
	"update",
	"updated",
	"firstUpdated",
	"willUpdate",
	"shouldUpdate",
	"performUpdate",
	"scheduleUpdate",
	"getUpdateComplete",
]);

const DOC_TAGS = new Set(["fires", "slot", "csspart"]);

const SVELTE_OPTION_TYPES = {
	Boolean: "boolean",
	Number: "number",
	String: "string",
	Object: "object",
	Array: "array",
};

const toPosix = (p) => p.split(path.sep).join("/");

const pascalCase = (stem) =>
	stem
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join("");

const camelCase = (attribute) =>
	attribute.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());

const squash = (text) => text.replace(/\s+/g, " ").trim();

/** `{ ...value }` without the keys whose value is `undefined` or empty. */
function compact(value) {
	const out = {};
	for (const [key, entry] of Object.entries(value)) {
		if (entry === undefined || entry === "") continue;
		if (Array.isArray(entry) && entry.length === 0) continue;
		out[key] = entry;
	}
	return out;
}

// ---------------------------------------------------------------------------
// Doc comments
// ---------------------------------------------------------------------------

const IGNORED_LINE_COMMENT = /^\s*(?:@ts-|biome-ignore|eslint-|prettier-|svelte-ignore)/;

/**
 * The description and tags of a comment body: `@tag rest` lines, each running
 * on until the next tag.
 */
export function parseDocText(text) {
	const description = [];
	const tags = [];
	for (const line of text.split("\n")) {
		const match = line.match(/^\s*@([A-Za-z-]+)\s*(.*)$/);
		if (match) {
			tags.push({ tag: match[1], text: match[2] });
		} else if (tags.length > 0) {
			tags[tags.length - 1].text += `\n${line}`;
		} else {
			description.push(line);
		}
	}
	return {
		description: description.join("\n").trim(),
		tags: tags.map(({ tag, text: body }) => ({ tag, text: body.trim() })),
	};
}

/** The body of a `/** *\/` block with its delimiters and margin stripped. */
function jsDocBody(raw) {
	return raw
		.replace(/^\/\*\*/, "")
		.replace(/\*\/$/, "")
		.split("\n")
		.map((line) => line.replace(/^\s*\* ?/, ""))
		.join("\n")
		.trim();
}

/**
 * The comment directly before `node`: its last `/** *\/` block, or else the
 * run of `//` lines that ends at the node. Tooling directives are skipped.
 */
function leadingDoc(sourceFile, node) {
	const text = sourceFile.text;
	const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
	const docs = ranges.filter(
		(range) =>
			range.kind === ts.SyntaxKind.MultiLineCommentTrivia &&
			text.startsWith("/**", range.pos),
	);
	if (docs.length > 0) {
		const last = docs[docs.length - 1];
		return jsDocBody(text.slice(last.pos, last.end));
	}
	const lines = [];
	for (let i = ranges.length - 1; i >= 0; i -= 1) {
		const range = ranges[i];
		if (range.kind !== ts.SyntaxKind.SingleLineCommentTrivia) break;
		const next = i + 1 < ranges.length ? ranges[i + 1].pos : node.getStart(sourceFile);
		if (/\n\s*\n/.test(text.slice(range.end, next))) break;
		const body = text.slice(range.pos + 2, range.end);
		if (IGNORED_LINE_COMMENT.test(body)) continue;
		lines.unshift(body.replace(/^ /, ""));
	}
	return lines.join("\n").trim();
}

/** Prose only: a doc comment's description with its tags dropped. */
const docDescription = (body) => squash(parseDocText(body).description);

/** A tag's `{type}` prefix, which may nest braces, and the text after it. */
function leadingBraces(text) {
	if (!text.startsWith("{")) return { type: undefined, rest: text };
	let depth = 0;
	for (let i = 0; i < text.length; i += 1) {
		if (text[i] === "{") depth += 1;
		if (text[i] === "}") depth -= 1;
		if (depth === 0) {
			return { type: squash(text.slice(1, i)), rest: text.slice(i + 1).trimStart() };
		}
	}
	return { type: undefined, rest: text };
}

/**
 * The surface an element documents: events, slots and parts, from the tags of
 * its `@component` comment or class JSDoc.
 */
function documentedSurface(body, where, problems) {
	const { description, tags } = parseDocText(body);
	const events = [];
	const slots = [];
	const cssParts = [];
	for (const { tag, text } of tags) {
		if (tag === "cssprop" || tag === "cssproperty") {
			problems.push(
				`${where}: @${tag} is not accepted; register the CSS custom property in ${TOKEN_REGISTRY}`,
			);
			continue;
		}
		if (!DOC_TAGS.has(tag)) {
			problems.push(`${where}: unknown doc tag @${tag}`);
			continue;
		}
		const { type, rest } = leadingBraces(text);
		const named = rest.match(/^([^\s-][^\s]*)?\s*(?:-\s*)?(.*)$/s);
		const name = named?.[1] ?? "";
		const summary = squash(named?.[2] ?? "");
		if (tag === "fires") {
			if (!name) {
				problems.push(`${where}: @fires needs an event name`);
				continue;
			}
			events.push(
				compact({ name, type: type ? { text: type } : undefined, description: summary }),
			);
		} else if (tag === "slot") {
			slots.push({ name, ...(summary ? { description: summary } : {}) });
		} else if (!name) {
			problems.push(`${where}: @csspart needs a part name`);
		} else {
			cssParts.push(compact({ name, description: summary }));
		}
	}
	return { description: squash(description), events, slots, cssParts };
}

// ---------------------------------------------------------------------------
// Source files
// ---------------------------------------------------------------------------

/**
 * Reads files once and resolves the bindings they declare and import, across
 * relative paths and `@pie-players/*` specifiers.
 */
class SourceIndex {
	constructor(root) {
		this.root = root;
		this.contexts = new Map();
		const entries = workspaceExports(root);
		this.packageSources = new Map(entries.map((entry) => [entry.specifier, entry.source]));
		// Source aliases have no build of their own: consumers compile them in.
		this.bundledSpecifiers = new Set(
			entries.filter((entry) => !entry.target).map((entry) => entry.specifier),
		);
	}

	resolveSpecifier(fromFile, specifier) {
		if (/\?|\.css$|\.json$/.test(specifier)) return undefined;
		if (specifier.startsWith(".")) {
			// The toolkit compiles `X.svelte` to `X.custom-element.js`.
			if (specifier.endsWith(".custom-element.js")) {
				const svelte = path.resolve(
					path.dirname(fromFile),
					specifier.replace(/\.custom-element\.js$/, ".svelte"),
				);
				if (existsSync(svelte)) return svelte;
			}
			return resolveRelative(fromFile, specifier);
		}
		return this.packageSources.get(specifier);
	}

	/** The parsed scripts and bindings of `file`. */
	context(file) {
		const cached = this.contexts.get(file);
		if (cached) return cached;
		const text = readFileSync(file, "utf8");
		const context = {
			file,
			scripts: [],
			moduleScripts: [],
			imports: new Map(),
			locals: new Map(),
			exported: new Map(),
			reexports: [],
			runtimeImports: [],
			svelte: undefined,
		};
		const addScript = (scriptText, isModule, offset = 0) => {
			const sourceFile = ts.createSourceFile(
				file,
				scriptText,
				ts.ScriptTarget.Latest,
				true,
				/\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS,
			);
			sourceFile.pieOffset = offset;
			context.scripts.push(sourceFile);
			if (isModule) context.moduleScripts.push(sourceFile);
			indexBindings(context, sourceFile, isModule);
		};
		if (file.endsWith(".svelte")) {
			const ast = parseSvelte(text, { modern: true });
			context.svelte = { ast, text };
			if (ast.module) {
				const { start, end } = ast.module.content;
				addScript(text.slice(start, end), true, start);
			}
			if (ast.instance) {
				const { start, end } = ast.instance.content;
				addScript(text.slice(start, end), false, start);
			}
		} else {
			addScript(text, true);
		}
		this.contexts.set(file, context);
		return context;
	}

	/** The declaration `name` names in `context`, followed through imports. */
	binding(context, name, seen = new Set()) {
		const local = context.locals.get(name);
		if (local) return { context, node: local };
		const imported = context.imports.get(name);
		if (!imported) return undefined;
		const target = this.resolveSpecifier(context.file, imported.specifier);
		if (!target) return undefined;
		if (imported.name === "default" && target.endsWith(".svelte")) {
			return { context: this.context(target), svelteComponent: target };
		}
		if (imported.name === "*") return undefined;
		return this.exportedBinding(target, imported.name, seen);
	}

	/** The declaration `file` exports as `name`. */
	exportedBinding(file, name, seen = new Set()) {
		const key = `${file}#${name}`;
		if (seen.has(key)) return undefined;
		seen.add(key);
		const context = this.context(file);
		if (name === "default" && file.endsWith(".svelte")) {
			return { context, svelteComponent: file };
		}
		const local = context.exported.get(name);
		if (local) return this.binding(context, local, seen);
		for (const { specifier, names } of context.reexports) {
			const target = this.resolveSpecifier(file, specifier);
			if (!target) continue;
			if (names) {
				if (names.has(name)) return this.exportedBinding(target, names.get(name), seen);
				continue;
			}
			const found = this.exportedBinding(target, name, seen);
			if (found) return found;
		}
		return undefined;
	}

	/**
	 * The expression `expression` evaluates to, as far as constants go: through
	 * casts, `const` bindings, imports, object members and a Svelte component's
	 * `.element`. `env` maps parameter names to the arguments a call passed.
	 */
	value(context, expression, env = new Map(), depth = 0) {
		if (!expression || depth > 12) return undefined;
		let node = expression;
		while (
			ts.isParenthesizedExpression(node) ||
			ts.isAsExpression(node) ||
			ts.isSatisfiesExpression(node) ||
			ts.isNonNullExpression(node) ||
			ts.isTypeAssertionExpression(node)
		) {
			node = node.expression;
		}
		if (ts.isIdentifier(node)) {
			if (env.has(node.text)) {
				const bound = env.get(node.text);
				return this.value(bound.context, bound.expression, bound.env, depth + 1);
			}
			const found = this.binding(context, node.text);
			if (!found) return undefined;
			if (found.svelteComponent) return found;
			if (ts.isVariableDeclaration(found.node)) {
				return this.value(found.context, found.node.initializer, new Map(), depth + 1);
			}
			return found;
		}
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			const key = ts.isPropertyAccessExpression(node)
				? node.name.text
				: ts.isStringLiteralLike(node.argumentExpression)
					? node.argumentExpression.text
					: undefined;
			if (key === undefined) return undefined;
			const target = this.value(context, node.expression, env, depth + 1);
			if (!target) return undefined;
			if (target.svelteComponent) {
				return key === "element" ? { ...target, svelteElement: true } : undefined;
			}
			if (target.node && ts.isObjectLiteralExpression(target.node)) {
				const member = target.node.properties.find(
					(property) =>
						ts.isPropertyAssignment(property) && propertyName(property.name) === key,
				);
				return member
					? this.value(target.context, member.initializer, new Map(), depth + 1)
					: undefined;
			}
			return undefined;
		}
		return { context, node };
	}

	string(context, expression, env) {
		const found = this.value(context, expression, env);
		return found?.node && ts.isStringLiteralLike(found.node) ? found.node.text : undefined;
	}

	strings(context, expression, env) {
		const found = this.value(context, expression, env);
		if (!found?.node || !ts.isArrayLiteralExpression(found.node)) return undefined;
		const values = found.node.elements.map((element) =>
			this.string(found.context, element),
		);
		return values.every((value) => value !== undefined) ? values : undefined;
	}

	/** The element a constructor expression names. */
	constructorRef(context, expression, env) {
		const found = this.value(context, expression, env);
		if (!found) return undefined;
		if (found.svelteElement) return { kind: "svelte", file: found.svelteComponent };
		if (found.node && ts.isClassDeclaration(found.node) && found.node.name) {
			return { kind: "class", file: found.context.file, name: found.node.name.text };
		}
		return undefined;
	}
}

function propertyName(name) {
	if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
		return name.text;
	}
	return undefined;
}

function hasModifier(node, kind) {
	return ts.canHaveModifiers(node)
		? (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind)
		: false;
}

function bindingIdentifiers(name, out) {
	if (ts.isIdentifier(name)) {
		out.push(name);
		return;
	}
	for (const element of name.elements) {
		if (ts.isBindingElement(element)) bindingIdentifiers(element.name, out);
	}
}

/** Records what a script declares, imports, exports and loads at run time. */
function indexBindings(context, sourceFile, isModule) {
	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement)) {
			const specifier = statement.moduleSpecifier.text;
			const clause = statement.importClause;
			const named =
				clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
					? clause.namedBindings.elements
					: [];
			const typeOnly =
				clause?.isTypeOnly ||
				(clause && !clause.name && named.length > 0 && named.every((e) => e.isTypeOnly));
			if (!typeOnly) context.runtimeImports.push(specifier);
			if (clause?.name) {
				context.imports.set(clause.name.text, { specifier, name: "default" });
			}
			if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
				context.imports.set(clause.namedBindings.name.text, { specifier, name: "*" });
			}
			for (const element of named) {
				context.imports.set(element.name.text, {
					specifier,
					name: (element.propertyName ?? element.name).text,
				});
			}
			continue;
		}
		if (ts.isExportDeclaration(statement)) {
			const specifier =
				statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
					? statement.moduleSpecifier.text
					: undefined;
			const clause = statement.exportClause;
			if (specifier) {
				if (!statement.isTypeOnly) context.runtimeImports.push(specifier);
				if (!clause) {
					context.reexports.push({ specifier, names: undefined });
				} else if (ts.isNamedExports(clause)) {
					context.reexports.push({
						specifier,
						names: new Map(
							clause.elements.map((element) => [
								element.name.text,
								(element.propertyName ?? element.name).text,
							]),
						),
					});
				}
			} else if (clause && ts.isNamedExports(clause)) {
				for (const element of clause.elements) {
					context.exported.set(
						element.name.text,
						(element.propertyName ?? element.name).text,
					);
				}
			}
			continue;
		}
		const exported = isModule && hasModifier(statement, ts.SyntaxKind.ExportKeyword);
		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				const names = [];
				bindingIdentifiers(declaration.name, names);
				for (const identifier of names) {
					context.locals.set(identifier.text, declaration);
					if (exported) context.exported.set(identifier.text, identifier.text);
				}
			}
			continue;
		}
		if (
			(ts.isClassDeclaration(statement) ||
				ts.isFunctionDeclaration(statement) ||
				ts.isInterfaceDeclaration(statement) ||
				ts.isTypeAliasDeclaration(statement) ||
				ts.isEnumDeclaration(statement)) &&
			statement.name
		) {
			context.locals.set(statement.name.text, statement);
			if (exported) {
				const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
				context.exported.set(isDefault ? "default" : statement.name.text, statement.name.text);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------

const elementKey = (ref) =>
	ref.kind === "class" ? `${ref.file}#${ref.name}` : ref.file;

const calleeName = (expression) => {
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
	return "";
};

/** Top-level statements, including those inside top-level blocks and ifs. */
function* topLevelCalls(sourceFile) {
	const visit = function* (statements) {
		for (const statement of statements) {
			if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
				yield statement.expression;
			} else if (ts.isBlock(statement)) {
				yield* visit(statement.statements);
			} else if (ts.isIfStatement(statement)) {
				for (const branch of [statement.thenStatement, statement.elseStatement]) {
					if (!branch) continue;
					yield* visit(ts.isBlock(branch) ? branch.statements : [branch]);
				}
			}
		}
	};
	yield* visit(sourceFile.statements);
}

function descendantCalls(node, out = []) {
	ts.forEachChild(node, (child) => {
		if (ts.isCallExpression(child)) out.push(child);
		if (!ts.isFunctionLike(child)) descendantCalls(child, out);
	});
	return out;
}

/**
 * The tags a call registers: directly, when the callee's name contains
 * "define" and its first two arguments resolve to a tag and a constructor, or
 * through the body of the function it calls.
 */
function callRegistrations(index, context, call, env, depth) {
	if (depth > 4) return [];
	if (/define/i.test(calleeName(call.expression)) && call.arguments.length >= 2) {
		const tag = index.string(context, call.arguments[0], env);
		const element = index.constructorRef(context, call.arguments[1], env);
		if (tag && element) return [{ tag, element }];
	}
	if (!ts.isIdentifier(call.expression)) return [];
	const found = index.binding(context, call.expression.text);
	const fn = found?.node;
	if (!fn || !ts.isFunctionDeclaration(fn) || !fn.body) return [];
	const inner = new Map();
	fn.parameters.forEach((parameter, position) => {
		if (!ts.isIdentifier(parameter.name)) return;
		const argument = call.arguments[position];
		if (argument) {
			inner.set(parameter.name.text, { context, expression: argument, env });
		} else if (parameter.initializer) {
			inner.set(parameter.name.text, {
				context: found.context,
				expression: parameter.initializer,
				env: new Map(),
			});
		}
	});
	return descendantCalls(fn.body).flatMap((innerCall) =>
		callRegistrations(index, found.context, innerCall, inner, depth + 1),
	);
}

function fileRegistrations(index, context) {
	if (context.registrations) return context.registrations;
	const registrations = [];
	const tag = context.svelte?.ast.options?.customElement?.tag;
	if (typeof tag === "string") {
		registrations.push({ tag, element: { kind: "svelte", file: context.file } });
	}
	for (const sourceFile of context.moduleScripts) {
		for (const call of topLevelCalls(sourceFile)) {
			registrations.push(...callRegistrations(index, context, call, new Map(), 0));
		}
	}
	context.registrations = registrations;
	return registrations;
}

/** Every tag importing `entry` registers, with the file that registers it. */
function entryRegistrations(index, entry) {
	const found = new Map();
	const seen = new Set();
	const queue = [entry];
	while (queue.length > 0) {
		const file = queue.shift();
		if (seen.has(file)) continue;
		seen.add(file);
		const context = index.context(file);
		for (const registration of fileRegistrations(index, context)) {
			if (!found.has(registration.tag)) found.set(registration.tag, registration);
		}
		for (const specifier of context.runtimeImports) {
			const target = index.resolveSpecifier(file, specifier);
			if (target && !seen.has(target)) queue.push(target);
		}
	}
	return found;
}

/**
 * The files `file` loads at run time that build into its package: its own
 * package's, and those of source aliases it imports from another package. With
 * `stopAtElements`, an imported file that registers an element of its own is
 * not entered.
 */
function localClosure(index, file, packageDir, { stopAtElements }) {
	const seen = new Set([file]);
	const entered = new Set([file]);
	const queue = [file];
	const bundledRoots = [];
	while (queue.length > 0) {
		const current = queue.shift();
		const context = index.context(current);
		for (const specifier of context.runtimeImports) {
			const target = index.resolveSpecifier(current, specifier);
			if (!target || seen.has(target)) continue;
			if (index.bundledSpecifiers.has(specifier)) bundledRoots.push(path.dirname(target));
			const inBuild =
				target.startsWith(packageDir + path.sep) ||
				bundledRoots.some((dir) => target.startsWith(dir + path.sep));
			if (!inBuild) continue;
			seen.add(target);
			if (stopAtElements && fileRegistrations(index, index.context(target)).length > 0) {
				continue;
			}
			entered.add(target);
			queue.push(target);
		}
	}
	return entered;
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function staticAttribute(node, name) {
	const attribute = node.attributes?.find(
		(entry) => entry.type === "Attribute" && entry.name === name,
	);
	if (!attribute || !Array.isArray(attribute.value)) return undefined;
	if (!attribute.value.every((part) => part.type === "Text")) return undefined;
	return attribute.value.map((part) => part.data).join("");
}

function collectStrings(node, out) {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const entry of node) collectStrings(entry, out);
		return;
	}
	if (node.type === "Literal" && typeof node.value === "string") out.push(node.value);
	if (node.type === "TemplateLiteral") return;
	for (const [key, value] of Object.entries(node)) {
		if (key !== "metadata" && key !== "parent") collectStrings(value, out);
	}
}

/** The slots, parts and `pie-*` classes the template of a `.svelte` file renders. */
function markupSurface(ast) {
	const slots = new Set();
	const parts = new Set();
	const classes = new Set();
	const addClasses = (text) => {
		for (const token of text.split(/\s+/)) {
			if (/^pie-[A-Za-z0-9_-]*[A-Za-z0-9_]$/.test(token)) classes.add(token);
		}
	};
	const visit = (node) => {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const entry of node) visit(entry);
			return;
		}
		if (node.type === "SlotElement") slots.add(staticAttribute(node, "name") ?? "");
		if (node.attributes) {
			const part = staticAttribute(node, "part");
			if (part) for (const name of part.split(/\s+/).filter(Boolean)) parts.add(name);
			for (const attribute of node.attributes) {
				if (attribute.type === "ClassDirective") addClasses(attribute.name);
				if (attribute.type !== "Attribute" || attribute.name !== "class") continue;
				const values = Array.isArray(attribute.value) ? attribute.value : [attribute.value];
				for (const value of values) {
					if (value?.type === "Text") {
						addClasses(value.data);
					} else if (value?.type === "ExpressionTag") {
						const strings = [];
						collectStrings(value.expression, strings);
						for (const text of strings) addClasses(text);
					}
				}
			}
		}
		for (const [key, value] of Object.entries(node)) {
			if (key === "metadata" || key === "parent" || key === "attributes") continue;
			if (value && typeof value === "object") visit(value);
		}
	};
	visit(ast.fragment);
	return { slots, parts, classes };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const isEventConstructor = (node) =>
	ts.isNewExpression(node) &&
	ts.isIdentifier(node.expression) &&
	/^(?:Custom)?Event$/.test(node.expression.text) &&
	node.arguments?.length > 0;

/**
 * The function a binding declares: a function declaration, a `const` arrow or
 * a class method.
 */
function functionOf(found) {
	const node = found?.node;
	if (!node) return undefined;
	if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.body) return node;
	if (ts.isVariableDeclaration(node) && node.initializer) {
		const value = unwrapCasts(node.initializer);
		if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return value;
	}
	return undefined;
}

/** The method `this.name` names inside the class that encloses `node`. */
function thisMethod(node, name) {
	for (let current = node.parent; current; current = current.parent) {
		if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
			return current.members.find(
				(member) =>
					ts.isMethodDeclaration(member) &&
					(ts.isPrivateIdentifier(member.name) ? member.name.text : propertyName(member.name)) ===
						name,
			);
		}
	}
	return undefined;
}

/** The binding a call's callee names: a function in scope, or `this.method`. */
function callTarget(index, context, call) {
	const callee = call.expression;
	if (ts.isIdentifier(callee)) return index.binding(context, callee.text);
	if (
		ts.isPropertyAccessExpression(callee) &&
		callee.expression.kind === ts.SyntaxKind.ThisKeyword
	) {
		const method = thisMethod(call, callee.name.text);
		return method ? { context, node: method } : undefined;
	}
	return undefined;
}

/**
 * The position of the parameter a dispatch wrapper turns into an event name:
 * one it passes to `new CustomEvent(...)`, or on to another such wrapper.
 */
function eventParameter(index, found, depth = 0) {
	const fn = functionOf(found);
	if (!fn || depth > 3) return undefined;
	if (fn.pieEventParameter !== undefined) return fn.pieEventParameter ?? undefined;
	fn.pieEventParameter = null;
	const parameters = fn.parameters.map((parameter) =>
		ts.isIdentifier(parameter.name) ? parameter.name.text : undefined,
	);
	let position;
	const visit = (node) => {
		if (position !== undefined) return;
		const forwarded = (argument) =>
			argument && ts.isIdentifier(argument) ? parameters.indexOf(argument.text) : -1;
		if (isEventConstructor(node) && forwarded(node.arguments[0]) !== -1) {
			position = forwarded(node.arguments[0]);
			return;
		}
		if (ts.isCallExpression(node)) {
			const inner = eventParameter(index, callTarget(index, found.context, node), depth + 1);
			if (inner !== undefined && forwarded(node.arguments[inner]) !== -1) {
				position = forwarded(node.arguments[inner]);
				return;
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(fn.body);
	fn.pieEventParameter = position ?? null;
	return position;
}

/**
 * A Svelte template's expressions, each parsed as a script of its own so its
 * identifiers resolve through the component's bindings.
 */
function markupExpressions(context) {
	if (!context.svelte) return [];
	if (context.markupExpressions) return context.markupExpressions;
	const { ast, text } = context.svelte;
	const found = [];
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const child of node) walk(child);
			return;
		}
		for (const [key, value] of Object.entries(node)) {
			if (key === "expression" && typeof value?.start === "number") {
				found.push(
					ts.createSourceFile(
						context.file,
						`(${text.slice(value.start, value.end)});`,
						ts.ScriptTarget.Latest,
						true,
						ts.ScriptKind.TS,
					),
				);
			} else if (key !== "metadata") {
				walk(value);
			}
		}
	};
	walk(ast.fragment);
	context.markupExpressions = found;
	return found;
}

/**
 * The event names a file's scripts and template dispatch under a static name:
 * through `new CustomEvent(name)`, a function or method that forwards its
 * argument there, or a `dispatch...Event` helper from outside the repository.
 */
function dispatchedEvents(index, context) {
	const names = new Set();
	const visit = (node) => {
		if (isEventConstructor(node)) {
			const name = index.string(context, node.arguments[0]);
			if (name) names.add(name);
		} else if (ts.isCallExpression(node)) {
			const callee = calleeName(node.expression);
			const position = eventParameter(index, callTarget(index, context, node));
			if (position !== undefined) {
				const name = index.string(context, node.arguments[position]);
				if (name) names.add(name);
			} else if (/^dispatch\w*Event$/.test(callee) && callee !== "dispatchEvent") {
				for (const argument of node.arguments) {
					const name = index.string(context, argument);
					if (name) {
						names.add(name);
						break;
					}
				}
			}
		}
		ts.forEachChild(node, visit);
	};
	for (const sourceFile of [...context.scripts, ...markupExpressions(context)]) visit(sourceFile);
	return names;
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

const typeOf = (text) =>
	text ? { text: squash(text).replace(/^[|&]\s*/, "") } : undefined;

function unwrapCasts(node) {
	let current = node;
	while (
		ts.isAsExpression(current) ||
		ts.isSatisfiesExpression(current) ||
		ts.isParenthesizedExpression(current) ||
		ts.isTypeAssertionExpression(current)
	) {
		current = current.expression;
	}
	return current;
}

/** The type an initializer implies: its outermost cast, else its literal kind. */
function initializerType(initializer, sourceFile) {
	if (!initializer) return undefined;
	if (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer)) {
		const text = initializer.type.getText(sourceFile);
		if (text !== "const" && text !== "unknown" && text !== "any") return text;
	}
	const value = unwrapCasts(initializer);
	if (ts.isStringLiteralLike(value)) return "string";
	if (ts.isNumericLiteral(value)) return "number";
	if (
		value.kind === ts.SyntaxKind.TrueKeyword ||
		value.kind === ts.SyntaxKind.FalseKeyword
	) {
		return "boolean";
	}
	return undefined;
}

function defaultText(initializer, sourceFile) {
	if (!initializer) return undefined;
	let value = unwrapCasts(initializer);
	if (
		ts.isCallExpression(value) &&
		ts.isIdentifier(value.expression) &&
		value.expression.text === "$bindable"
	) {
		if (!value.arguments[0]) return undefined;
		value = unwrapCasts(value.arguments[0]);
	}
	if (ts.isIdentifier(value) && value.text === "undefined") return undefined;
	return squash(value.getText(sourceFile));
}

/** Property signatures of a type node, followed through local and imported aliases. */
function typeMembers(index, context, typeNode, out = new Map(), depth = 0) {
	if (!typeNode || depth > 6) return out;
	const sourceFile = typeNode.getSourceFile();
	const addMembers = (members, ownerFile) => {
		for (const member of members) {
			if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) continue;
			const name = propertyName(member.name);
			if (!name || out.has(name)) continue;
			out.set(name, {
				type: member.type ? member.type.getText(ownerFile) : undefined,
				description: docDescription(leadingDoc(ownerFile, member)),
			});
		}
	};
	if (ts.isTypeLiteralNode(typeNode)) {
		addMembers(typeNode.members, sourceFile);
	} else if (ts.isIntersectionTypeNode(typeNode)) {
		for (const part of typeNode.types) typeMembers(index, context, part, out, depth + 1);
	} else if (ts.isParenthesizedTypeNode(typeNode)) {
		typeMembers(index, context, typeNode.type, out, depth + 1);
	} else if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
		const found = index.binding(context, typeNode.typeName.text);
		const declaration = found?.node;
		if (!declaration) return out;
		if (ts.isInterfaceDeclaration(declaration)) {
			addMembers(declaration.members, declaration.getSourceFile());
			for (const clause of declaration.heritageClauses ?? []) {
				for (const heritage of clause.types) {
					if (ts.isIdentifier(heritage.expression)) {
						const base = index.binding(found.context, heritage.expression.text);
						if (base?.node && ts.isInterfaceDeclaration(base.node)) {
							addMembers(base.node.members, base.node.getSourceFile());
						}
					}
				}
			}
		} else if (ts.isTypeAliasDeclaration(declaration)) {
			typeMembers(index, found.context, declaration.type, out, depth + 1);
		}
	}
	return out;
}

function methodMember(node, sourceFile, name) {
	const body = leadingDoc(sourceFile, node);
	const { tags } = parseDocText(body);
	const paramDocs = new Map();
	for (const { tag, text } of tags) {
		if (tag !== "param") continue;
		const match = text.match(/^(?:\{[^}]*\}\s*)?\[?([A-Za-z_$][\w$]*)[^\s]*\s*(?:-\s*)?(.*)$/s);
		if (match) paramDocs.set(match[1], squash(match[2]));
	}
	const fn = ts.isVariableDeclaration(node) ? unwrapCasts(node.initializer) : node;
	const parameters = (fn.parameters ?? []).map((parameter) => {
		const parameterName = parameter.name.getText(sourceFile);
		return compact({
			name: parameterName,
			type: typeOf(
				parameter.type?.getText(sourceFile) ??
					initializerType(parameter.initializer, sourceFile),
			),
			optional: parameter.questionToken || parameter.initializer ? true : undefined,
			default: parameter.initializer ? defaultText(parameter.initializer, sourceFile) : undefined,
			description: paramDocs.get(parameterName),
		});
	});
	return compact({
		kind: "method",
		name,
		description: docDescription(body),
		parameters,
		return: fn.type ? { type: typeOf(fn.type.getText(sourceFile)) } : undefined,
	});
}

const isPublicMember = (member, name) =>
	name &&
	!name.startsWith("_") &&
	!ts.isPrivateIdentifier(member.name) &&
	!hasModifier(member, ts.SyntaxKind.PrivateKeyword) &&
	!hasModifier(member, ts.SyntaxKind.ProtectedKeyword) &&
	!hasModifier(member, ts.SyntaxKind.StaticKeyword) &&
	!LIFECYCLE_MEMBERS.has(name);

/** The public fields, accessors and methods a class body declares. */
function classMembers(classNode, sourceFile) {
	const members = new Map();
	for (const member of classNode.members) {
		const name = member.name ? propertyName(member.name) : undefined;
		if (!isPublicMember(member, name)) continue;
		if (ts.isMethodDeclaration(member)) {
			members.set(name, methodMember(member, sourceFile, name));
			continue;
		}
		if (ts.isPropertyDeclaration(member)) {
			members.set(
				name,
				compact({
					kind: "field",
					name,
					type: typeOf(
						member.type?.getText(sourceFile) ??
							initializerType(member.initializer, sourceFile),
					),
					default: defaultText(member.initializer, sourceFile),
					description: docDescription(leadingDoc(sourceFile, member)),
					readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword) || undefined,
					node: member,
				}),
			);
			continue;
		}
		if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
			const existing = members.get(name);
			const type = ts.isGetAccessorDeclaration(member)
				? member.type?.getText(sourceFile)
				: member.parameters[0]?.type?.getText(sourceFile);
			const description = docDescription(leadingDoc(sourceFile, member));
			const field = existing ?? { kind: "field", name, node: member, readonly: true };
			if (!field.type && type) field.type = typeOf(type);
			if (!field.description && description) field.description = description;
			if (ts.isSetAccessorDeclaration(member)) delete field.readonly;
			if (!existing || !existing.decorated) field.node = existing?.node ?? member;
			members.set(name, field);
		}
	}
	return members;
}

/** The decorator `@property(...)` on a member, as its options object. */
function litProperty(member) {
	for (const decorator of ts.canHaveDecorators(member) ? (ts.getDecorators(member) ?? []) : []) {
		const expression = decorator.expression;
		if (!ts.isCallExpression(expression) || calleeName(expression.expression) !== "property") {
			continue;
		}
		const options = expression.arguments[0];
		return options && ts.isObjectLiteralExpression(options) ? options : ts.factory.createObjectLiteralExpression();
	}
	return undefined;
}

function objectEntry(object, key) {
	const entry = object.properties.find(
		(property) => ts.isPropertyAssignment(property) && propertyName(property.name) === key,
	);
	return entry?.initializer;
}

/** Classes a function returns, directly or from an arrow it returns. */
function returnedClasses(node, out = []) {
	const visit = (current) => {
		if (ts.isClassExpression(current) || ts.isClassDeclaration(current)) {
			out.push(current);
			return;
		}
		if (ts.isReturnStatement(current) && current.expression) {
			visit(unwrapCasts(current.expression));
			return;
		}
		if (ts.isArrowFunction(current) && !ts.isBlock(current.body)) {
			visit(unwrapCasts(current.body));
			return;
		}
		ts.forEachChild(current, visit);
	};
	ts.forEachChild(node, visit);
	return out;
}

/** Public members of the classes a Svelte element's `extend` option wraps it in. */
function extendMembers(index, context, extendNode) {
	const members = new Map();
	const helpers = new Set();
	const visit = (node) => {
		if (ts.isIdentifier(node)) helpers.add(node.text);
		ts.forEachChild(node, visit);
	};
	visit(extendNode);
	for (const name of helpers) {
		const found = index.binding(context, name);
		if (!found?.node || !ts.isFunctionDeclaration(found.node)) continue;
		const sourceFile = found.node.getSourceFile();
		for (const classNode of returnedClasses(found.node)) {
			for (const [memberName, member] of classMembers(classNode, sourceFile)) {
				if (!members.has(memberName)) members.set(memberName, member);
			}
		}
	}
	return members;
}

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

/** The `customElement` option object of a Svelte file, parsed for its comments. */
function svelteOptionsObject(context) {
	const { ast, text } = context.svelte;
	const attribute = ast.options?.attributes?.find((entry) => entry.name === "customElement");
	const expression = attribute?.value?.expression;
	if (!expression) return undefined;
	const sourceFile = ts.createSourceFile(
		`${context.file}.options.ts`,
		`(${text.slice(expression.start, expression.end)})`,
		ts.ScriptTarget.Latest,
		true,
	);
	const statement = sourceFile.statements[0];
	const object =
		statement && ts.isExpressionStatement(statement)
			? unwrapCasts(statement.expression)
			: undefined;
	return object && ts.isObjectLiteralExpression(object) ? { object, sourceFile } : undefined;
}

function findPropsDeclaration(sourceFile) {
	let found;
	const visit = (node) => {
		if (found) return;
		if (
			ts.isVariableDeclaration(node) &&
			node.initializer &&
			ts.isCallExpression(node.initializer) &&
			ts.isIdentifier(node.initializer.expression) &&
			node.initializer.expression.text === "$props"
		) {
			found = node;
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return found;
}

function componentComment(ast) {
	for (const node of ast.fragment.nodes) {
		if (node.type === "Comment" && node.data.trim().startsWith("@component")) {
			return node.data.trim().replace(/^@component/, "").trim();
		}
	}
	return undefined;
}

/** A Svelte element's declaration, with the files its markup and closure read. */
function svelteDeclaration(index, file, rel, problems) {
	const context = index.context(file);
	const ce = context.svelte.ast.options?.customElement ?? {};
	const optionProps = ce.props ?? {};
	const options = svelteOptionsObject(context);
	const optionDocs = new Map();
	let extendNode;
	if (options) {
		const props = objectEntry(options.object, "props");
		if (props && ts.isObjectLiteralExpression(props)) {
			for (const property of props.properties) {
				const name = property.name ? propertyName(property.name) : undefined;
				if (name) optionDocs.set(name, docDescription(leadingDoc(options.sourceFile, property)));
			}
		}
		extendNode = objectEntry(options.object, "extend");
	}

	const instance = context.scripts.find((script) => !context.moduleScripts.includes(script));
	const props = new Map();
	const declaration = instance ? findPropsDeclaration(instance) : undefined;
	if (declaration && ts.isObjectBindingPattern(declaration.name)) {
		const typeNode = declaration.type ?? declaration.initializer.typeArguments?.[0];
		const typed = typeMembers(index, context, typeNode);
		for (const element of declaration.name.elements) {
			if (element.dotDotDotToken) continue;
			const name = propertyName(element.propertyName ?? element.name);
			if (!name) continue;
			const fromType = typed.get(name);
			props.set(name, {
				type: fromType?.type ?? initializerType(element.initializer, instance),
				default: defaultText(element.initializer, instance),
				description:
					fromType?.description || docDescription(leadingDoc(instance, element)) || optionDocs.get(name),
				booleanLiteral:
					element.initializer &&
					[ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(
						unwrapCasts(element.initializer).kind,
					),
			});
		}
	}
	for (const name of Object.keys(optionProps)) {
		if (!props.has(name)) props.set(name, { description: optionDocs.get(name) });
	}

	const members = [];
	const attributes = [];
	for (const [name, prop] of props) {
		const option = optionProps[name] ?? {};
		let optionType = option.type;
		if (!optionType && name in optionProps && prop.booleanLiteral) optionType = "Boolean";
		const type = prop.type ?? SVELTE_OPTION_TYPES[optionType];
		const attribute = (option.attribute || name).toLowerCase();
		members.push(
			compact({
				kind: "field",
				name,
				type: typeOf(type),
				default: prop.default,
				description: prop.description,
				attribute,
				reflects: option.reflect === true ? true : undefined,
			}),
		);
		const attributeType =
			optionType === "Boolean"
				? "boolean"
				: optionType === "Number"
					? "number"
					: optionType === "Object" || optionType === "Array"
						? type
						: "string";
		attributes.push(
			compact({
				name: attribute,
				type: typeOf(attributeType),
				default: prop.default,
				description: prop.description,
				fieldName: name,
			}),
		);
	}

	if (instance) {
		for (const statement of instance.statements) {
			if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
			if (ts.isFunctionDeclaration(statement) && statement.name) {
				members.push(methodMember(statement, instance, statement.name.text));
			} else if (ts.isVariableStatement(statement)) {
				for (const variable of statement.declarationList.declarations) {
					if (!ts.isIdentifier(variable.name)) continue;
					const value = variable.initializer && unwrapCasts(variable.initializer);
					if (value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))) {
						members.push(methodMember(variable, instance, variable.name.text));
					}
				}
			}
		}
	}

	// The class `extend` returns is the element hosts call: its methods replace
	// the component's, and its accessors refine the props they wrap.
	if (extendNode) {
		for (const [name, member] of extendMembers(index, context, extendNode)) {
			const { node, decorated, ...plain } = member;
			const position = members.findIndex((entry) => entry.name === name);
			if (position === -1) {
				members.push(plain);
				continue;
			}
			const existing = members[position];
			if (existing.kind === "field") {
				existing.type ??= plain.type;
				existing.description ??= plain.description;
			} else {
				members[position] = compact({
					...plain,
					description: plain.description || existing.description,
				});
			}
		}
	}

	const where = `${rel(file)} @component`;
	const comment = componentComment(context.svelte.ast);
	const documented = documentedSurface(comment ?? "", where, problems);
	if (!documented.description) {
		problems.push(`${rel(file)}: add a <!-- @component --> comment describing the element`);
	}
	const shadow = ce.shadow === "none" ? "none" : "open";
	return {
		declaration: {
			description: documented.description,
			members,
			attributes,
			events: documented.events,
			slots: documented.slots,
			cssParts: documented.cssParts,
		},
		shadow,
		documented,
		context,
	};
}

/** A TypeScript or Lit element class's declaration. */
function classDeclaration(index, ref, rel, problems) {
	const context = index.context(ref.file);
	const found = context.locals.get(ref.name);
	const sourceFile = found.getSourceFile();
	const members = classMembers(found, sourceFile);
	const attributes = [];

	for (const member of found.members) {
		const name = member.name ? propertyName(member.name) : undefined;
		if (name !== "observedAttributes" || !hasModifier(member, ts.SyntaxKind.StaticKeyword)) {
			continue;
		}
		let expression;
		if (ts.isPropertyDeclaration(member)) expression = member.initializer;
		if (ts.isGetAccessorDeclaration(member) && member.body) {
			const returned = member.body.statements.find(ts.isReturnStatement);
			expression = returned?.expression;
		}
		const names = expression ? index.strings(context, expression) : undefined;
		if (!names) {
			problems.push(`${rel(ref.file)}: cannot read ${ref.name}.observedAttributes statically`);
			continue;
		}
		for (const attribute of names) {
			const fieldName = members.has(camelCase(attribute)) ? camelCase(attribute) : undefined;
			const field = fieldName ? members.get(fieldName) : undefined;
			if (field) field.attribute = attribute;
			attributes.push(
				compact({
					name: attribute,
					type: field?.type,
					description: field?.description,
					fieldName,
				}),
			);
		}
	}

	for (const member of found.members) {
		const options = litProperty(member);
		const name = member.name ? propertyName(member.name) : undefined;
		if (!options || !members.has(name)) continue;
		const field = members.get(name);
		const attributeOption = objectEntry(options, "attribute");
		if (attributeOption?.kind === ts.SyntaxKind.FalseKeyword) continue;
		const attribute =
			(attributeOption && ts.isStringLiteralLike(attributeOption) && attributeOption.text) ||
			name.toLowerCase();
		const litType = objectEntry(options, "type");
		const typeName = litType && ts.isIdentifier(litType) ? litType.text : undefined;
		field.attribute = attribute;
		if (objectEntry(options, "reflect")?.kind === ts.SyntaxKind.TrueKeyword) field.reflects = true;
		attributes.push(
			compact({
				name: attribute,
				type:
					typeName === "Boolean"
						? { text: "boolean" }
						: typeName === "Number"
							? { text: "number" }
							: typeName === "Object" || typeName === "Array"
								? field.type
								: { text: "string" },
				description: field.description,
				fieldName: name,
			}),
		);
	}

	const heritage = found.heritageClauses?.find(
		(clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
	)?.types[0]?.expression;
	// A superclass is named when it is a global, an import or a local class; a
	// local binding such as an SSR-safe `HTMLElement` stand-in is left out.
	let superclass;
	if (heritage && ts.isIdentifier(heritage)) {
		const imported = context.imports.get(heritage.text);
		const local = context.locals.get(heritage.text);
		if (imported) {
			superclass = compact({
				name: imported.name !== "default" ? imported.name : heritage.text,
				package: imported.specifier.startsWith(".") ? undefined : imported.specifier,
			});
		} else if (!local || ts.isClassDeclaration(local)) {
			superclass = { name: heritage.text };
		}
	}

	const fileText = sourceFile.text;
	const rendersIntoSelf = found.members.some(
		(member) =>
			ts.isMethodDeclaration(member) &&
			propertyName(member.name) === "createRenderRoot" &&
			/return\s+this\b/.test(member.getText(sourceFile)),
	);
	const shadow =
		/attachShadow\s*\(/.test(fileText) ||
		(superclass?.name === "LitElement" && !rendersIntoSelf)
			? "open"
			: "none";

	const where = `${rel(ref.file)} ${ref.name}`;
	const documented = documentedSurface(leadingDoc(sourceFile, found), where, problems);
	if (!documented.description) {
		problems.push(`${where}: add a JSDoc comment describing the element`);
	}
	return {
		declaration: {
			description: documented.description,
			superclass,
			members: [...members.values()].map(({ node, decorated, ...plain }) => plain),
			attributes,
			events: documented.events,
			slots: documented.slots,
			cssParts: documented.cssParts,
		},
		shadow,
		documented,
		context,
	};
}

// ---------------------------------------------------------------------------
// Token registry
// ---------------------------------------------------------------------------

function readTokens(root) {
	const tokens = JSON.parse(readFileSync(path.join(root, TOKEN_REGISTRY), "utf8"));
	const cssProperty = (token) =>
		compact({
			name: token.name,
			description: squash(token.fallbackPolicy ?? ""),
			deprecated: token.status === "deprecated" ? true : undefined,
		});
	return {
		theme: tokens
			.filter(
				(token) =>
					token.owner === THEME_PACKAGE &&
					(token.scope === "canonical-semantic" || token.scope === "legacy") &&
					token.status !== "planned",
			)
			.map(cssProperty),
		component: tokens
			.filter((token) => token.scope === "component-public" && token.status !== "planned")
			.map((token) => ({
				property: cssProperty(token),
				files: token.definedIn
					.filter((file) => !file.startsWith("packages/theme/"))
					.map((file) => path.join(root, file)),
			})),
	};
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

const comparePaths = (a, b) => {
	const depth = a.split("/").length - b.split("/").length;
	return depth !== 0 ? depth : a < b ? -1 : a > b ? 1 : 0;
};

/**
 * Every publishable package's manifest, keyed by package name, with the
 * problems that block publishing one and notices that do not.
 */
export function buildManifests(root = REPO_ROOT) {
	const rel = (file) => toPosix(path.relative(root, file));
	const problems = [];
	const notices = [];
	const index = new SourceIndex(root);
	const packages = workspacePackages(root).filter(({ manifest }) => !manifest.private);
	const exportsBySpecifier = workspaceExports(root);
	const resolvePackage = (specifier) => index.packageSources.get(specifier);

	// Package -> module path -> { sources, registrations }.
	const packageModules = new Map();
	for (const pkg of packages) {
		const modules = new Map();
		for (const entry of exportsBySpecifier) {
			if (!entry.target) continue;
			if (entry.specifier !== pkg.name && !entry.specifier.startsWith(`${pkg.name}/`)) continue;
			const modulePath = toPosix(path.relative(pkg.dir, entry.target));
			const module = modules.get(modulePath) ?? { sources: new Set(), registrations: new Map() };
			module.sources.add(entry.source);
			for (const [tag, registration] of entryRegistrations(index, entry.source)) {
				module.registrations.set(tag, registration);
			}
			modules.set(modulePath, module);
		}
		packageModules.set(pkg.name, modules);
	}

	const packageOf = (file) =>
		packages.find((pkg) => file.startsWith(pkg.dir + path.sep));

	// Element key -> { pkg, modulePath, tag, ref } for its declaring module.
	const placements = new Map();
	for (const pkg of packages) {
		const candidates = new Map();
		for (const [modulePath, module] of packageModules.get(pkg.name)) {
			for (const [tag, registration] of module.registrations) {
				if (packageOf(registration.element.file) !== pkg) continue;
				const key = elementKey(registration.element);
				const entry = candidates.get(key) ?? { tag, ref: registration.element, modules: [] };
				entry.modules.push(modulePath);
				candidates.set(key, entry);
			}
		}
		for (const [key, { tag, ref, modules }] of candidates) {
			const exporting =
				ref.kind === "class"
					? modules.filter((modulePath) =>
							[...packageModules.get(pkg.name).get(modulePath).sources].some(
								(source) =>
									moduleExports(source, { resolvePackage }).names.get(ref.name) === "value",
							),
						)
					: [];
			const pool = exporting.length > 0 ? exporting : modules;
			const size = (modulePath) =>
				packageModules.get(pkg.name).get(modulePath).registrations.size;
			const [modulePath] = [...pool].sort(
				(a, b) => size(a) - size(b) || comparePaths(a, b),
			);
			placements.set(key, { pkg, modulePath, tag, ref });
		}
	}

	const tokens = readTokens(root);
	const attachedTokens = new Set();
	const declarations = new Map();
	for (const [key, placement] of placements) {
		const { pkg, tag, ref } = placement;
		const name = ref.kind === "class" ? ref.name : pascalCase(path.basename(ref.file, ".svelte"));
		const built =
			ref.kind === "class"
				? classDeclaration(index, ref, rel, problems)
				: svelteDeclaration(index, ref.file, rel, problems);
		const where = `${rel(ref.file)}${ref.kind === "class" ? ` ${ref.name}` : ""}`;

		// Markup. Slots are the element's own template's: a `<slot>` in a
		// component it renders is that component's. Parts and classes come from
		// every template the element renders, up to the next element.
		const ownFiles = localClosure(index, ref.file, pkg.dir, { stopAtElements: true });
		const markup = { slots: new Set(), parts: new Set(), classes: new Set() };
		for (const file of ownFiles) {
			if (!file.endsWith(".svelte")) continue;
			const surface = markupSurface(index.context(file).svelte.ast);
			if (file === ref.file) markup.slots = surface.slots;
			for (const value of surface.parts) markup.parts.add(value);
			for (const value of surface.classes) markup.classes.add(value);
		}
		if (built.shadow === "none" && markup.slots.size > 0) {
			problems.push(`${where}: renders <slot> without a shadow root, where it does not project`);
		}
		const documentedSlots = new Set(built.documented.slots.map((slot) => slot.name));
		for (const slot of markup.slots) {
			if (!documentedSlots.has(slot)) {
				problems.push(`${where}: document ${slot ? `slot "${slot}"` : "the default slot"} with @slot`);
			}
		}
		for (const slot of documentedSlots) {
			if (ref.kind === "svelte" && !markup.slots.has(slot)) {
				problems.push(`${where}: @slot ${slot || "(default)"} is not rendered`);
			}
		}
		const documentedParts = new Set(built.documented.cssParts.map((part) => part.name));
		for (const part of markup.parts) {
			if (!documentedParts.has(part)) problems.push(`${where}: document part "${part}" with @csspart`);
		}
		for (const part of documentedParts) {
			if (ref.kind === "svelte" && !markup.parts.has(part)) {
				problems.push(`${where}: @csspart ${part} is not rendered`);
			}
		}

		// Events dispatched under a static name anywhere the element renders, up
		// to the next element.
		const documentedEvents = new Set(built.documented.events.map((event) => event.name));
		const dispatched = new Set();
		for (const file of ownFiles) {
			for (const event of dispatchedEvents(index, index.context(file))) dispatched.add(event);
		}
		for (const event of dispatched) {
			if (!documentedEvents.has(event)) {
				problems.push(`${where}: document event "${event}" with @fires`);
			}
		}

		// CSS custom properties: the theme's own, and component tokens defined
		// anywhere the element renders.
		const reach = localClosure(index, ref.file, pkg.dir, { stopAtElements: false });
		const cssProperties =
			pkg.name === THEME_PACKAGE && tag === "pie-theme" ? [...tokens.theme] : [];
		for (const token of tokens.component) {
			if (token.files.some((file) => reach.has(file))) {
				cssProperties.push(token.property);
				attachedTokens.add(token.property.name);
			}
		}

		declarations.set(
			key,
			compact({
				kind: "class",
				description: built.declaration.description,
				name,
				tagName: tag,
				customElement: true,
				superclass: built.declaration.superclass,
				members: built.declaration.members,
				attributes: built.declaration.attributes,
				events: built.declaration.events,
				slots: built.declaration.slots.sort(byName),
				cssParts: built.declaration.cssParts.sort(byName),
				cssProperties: cssProperties.sort(byName),
				"x-pie": compact({
					shadow: built.shadow,
					classes: built.shadow === "none" ? [...markup.classes].sort() : undefined,
				}),
			}),
		);
		placement.name = name;
	}
	for (const token of tokens.component) {
		if (!attachedTokens.has(token.property.name)) {
			notices.push(`${token.property.name}: no element renders the files that define it`);
		}
	}

	const manifests = new Map();
	for (const pkg of packages) {
		const modules = [];
		for (const [modulePath, module] of [...packageModules.get(pkg.name)].sort(([a], [b]) =>
			comparePaths(a, b),
		)) {
			if (module.registrations.size === 0) continue;
			const moduleDeclarations = [];
			const moduleExportsList = [];
			const exportedNames = new Map();
			for (const source of module.sources) {
				for (const [exported, kind] of moduleExports(source, { resolvePackage }).names) {
					if (kind === "value") exportedNames.set(exported, true);
				}
			}
			for (const [tag, registration] of [...module.registrations].sort(([a], [b]) =>
				a < b ? -1 : 1,
			)) {
				const key = elementKey(registration.element);
				const placement = placements.get(key);
				if (!placement) {
					problems.push(
						`${pkg.name} ${modulePath}: <${tag}> is registered from ${rel(registration.element.file)}, which no export of its own package registers`,
					);
					continue;
				}
				const local = placement.pkg === pkg && placement.modulePath === modulePath;
				if (local) moduleDeclarations.push(declarations.get(key));
				const reference = compact({
					name: placement.name,
					module: local ? undefined : placement.modulePath,
					package: placement.pkg === pkg ? undefined : placement.pkg.name,
				});
				moduleExportsList.push({
					kind: "custom-element-definition",
					name: tag,
					declaration: reference,
				});
				// A Svelte component's export is the component; its element class is
				// reachable only through the registry.
				if (
					placement.ref.kind === "class" &&
					placement.pkg === pkg &&
					exportedNames.has(placement.name)
				) {
					moduleExportsList.push({
						kind: "js",
						name: placement.name,
						declaration: compact({
							name: placement.name,
							module: local ? undefined : placement.modulePath,
						}),
					});
				}
			}
			modules.push({
				kind: "javascript-module",
				path: modulePath,
				declarations: moduleDeclarations.sort(byName),
				exports: moduleExportsList.sort(
					(a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : byName(a, b)),
				),
			});
		}
		if (modules.length === 0) continue;
		manifests.set(pkg.name, {
			dir: pkg.dir,
			manifest: { schemaVersion: SCHEMA_VERSION, modules },
		});
	}
	return { manifests, problems: [...new Set(problems)], notices };
}

/** The manifest as committed: tab-indented JSON with a final newline. */
export const formatManifest = (manifest) => `${JSON.stringify(manifest, null, "\t")}\n`;

/**
 * One line per public surface fact, for diffing two versions of a manifest:
 * each element's tag, and each attribute, property, method, event, slot, part
 * and CSS custom property with the type it carries.
 */
export function surfaceKeys(manifest) {
	const keys = new Set();
	for (const module of manifest?.modules ?? []) {
		for (const declaration of module.declarations ?? []) {
			if (!declaration.customElement) continue;
			const tag = declaration.tagName;
			keys.add(`<${tag}>`);
			for (const attribute of declaration.attributes ?? []) {
				keys.add(`<${tag}> attribute ${attribute.name}: ${attribute.type?.text ?? ""}`);
			}
			for (const member of declaration.members ?? []) {
				if (member.kind === "method") {
					const parameters = (member.parameters ?? [])
						.map((parameter) => `${parameter.name}: ${parameter.type?.text ?? ""}`)
						.join(", ");
					keys.add(
						`<${tag}> method ${member.name}(${parameters}): ${member.return?.type?.text ?? ""}`,
					);
				} else {
					keys.add(`<${tag}> property ${member.name}: ${member.type?.text ?? ""}`);
				}
			}
			for (const event of declaration.events ?? []) {
				keys.add(`<${tag}> event ${event.name}: ${event.type?.text ?? ""}`);
			}
			for (const slot of declaration.slots ?? []) keys.add(`<${tag}> slot ${slot.name}`);
			for (const part of declaration.cssParts ?? []) keys.add(`<${tag}> part ${part.name}`);
			for (const property of declaration.cssProperties ?? []) {
				keys.add(`<${tag}> css-property ${property.name}`);
			}
		}
	}
	return keys;
}

