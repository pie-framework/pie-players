import {
	createBuiltInColorSchemeDescriptor,
	createPieColorSchemePreview,
	diagnoseThemeContrast,
	getBaseThemeVariables,
	getBuiltInColorSchemeDefinition,
	getDefaultColorSchemeDescriptor,
	getSchemeParticipation,
	listBuiltInColorSchemeDefinitions,
} from "./theme-definitions.js";
import {
	normalizePieThemeVariables,
	type ColorSchemeSnapshot,
	type PieColorSchemeDescriptor,
	type PieThemeObserver,
	type PieThemeDiagnostic,
	type RegisteredPieColorScheme,
	type RegistrationReceipt,
	type ResolvePieThemeInput,
	type ThemeResolution,
	type ThemeVariables,
	type Unsubscribe,
} from "./theme-types.js";

type CustomSchemeRecord = Readonly<{
	key: number;
	id: string;
	name: string;
	description?: string;
	variables: Readonly<ThemeVariables>;
}>;

const customSchemes = new Map<string, CustomSchemeRecord>();
const observers = new Set<PieThemeObserver>();
const notificationQueue: ColorSchemeSnapshot[] = [];
const warnedDiagnostics = new Set<string>();
const BUILT_IN_IDS = new Set(
	listBuiltInColorSchemeDefinitions().map((scheme) => scheme.id),
);
let generation = 0;
let nextRegistrationKey = 1;
let notifying = false;

const OPAQUE_NAMED_COLORS = new Set(
	`aliceblue antiquewhite aqua aquamarine azure beige bisque black
	blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse
	chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
	darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
	darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
	darkslateblue darkslategray darkslategrey darkturquoise darkviolet
	deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
	forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green
	greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender
	lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
	lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon
	lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue
	lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue
	mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
	mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
	navajowhite navy oldlace olive olivedrab orange orangered orchid
	palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff
	peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
	saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
	slateblue slategray slategrey snow springgreen steelblue tan teal thistle
	tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(
		/\s+/,
	),
);
const CSS_NUMBER_SOURCE = String.raw`[+-]?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?`;
const CSS_NUMBER = new RegExp(`^${CSS_NUMBER_SOURCE}$`, "i");
const CSS_PERCENTAGE = new RegExp(`^${CSS_NUMBER_SOURCE}%$`, "i");
const CSS_NUMBER_OR_PERCENTAGE = new RegExp(`^${CSS_NUMBER_SOURCE}%?$`, "i");
const CSS_ANGLE = new RegExp(
	`^${CSS_NUMBER_SOURCE}(?:deg|grad|rad|turn)?$`,
	"i",
);
const CSS_WHITESPACE = /[ \t\n\f\r]+/;
const CSS_COLOR_SPACES = new Set([
	"srgb",
	"srgb-linear",
	"display-p3",
	"a98-rgb",
	"prophoto-rgb",
	"rec2020",
	"xyz",
	"xyz-d50",
	"xyz-d65",
]);

function freezeVariables(variables: ThemeVariables): Readonly<ThemeVariables> {
	return Object.freeze({ ...variables });
}

function freezeDiagnostics(
	diagnostics: readonly PieThemeDiagnostic[],
): readonly PieThemeDiagnostic[] {
	return Object.freeze(
		diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic })),
	);
}

function trimCssWhitespace(value: string): string {
	return value.replace(/^[ \t\n\f\r]+|[ \t\n\f\r]+$/g, "");
}

function isAscii(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		if (value.charCodeAt(index) > 0x7f) return false;
	}
	return true;
}

function hasComponents(
	body: string,
	predicates: readonly RegExp[],
	allowCommas = false,
): boolean {
	if (body.includes("/")) return false;
	const hasCommas = body.includes(",");
	if (hasCommas && !allowCommas) return false;
	const components = (
		hasCommas ? body.split(",") : trimCssWhitespace(body).split(CSS_WHITESPACE)
	).map(trimCssWhitespace);
	return (
		components.length === predicates.length &&
		components.every(
			(component, index) =>
				component.length > 0 && predicates[index]?.test(component),
		)
	);
}

/**
 * A Scheme Preview is portable catalog data, so retain only deterministic,
 * opaque color forms that can be checked identically without a DOM. Unsupported
 * syntax affects the preview swatch only; the authored theme variable is kept.
 */
function isStablePreviewColor(value: string | undefined): boolean {
	// This deliberately supported preview subset is ASCII. Rejecting other code
	// points also prevents JavaScript's broader whitespace and Unicode case folding
	// from accepting strings that CSS tokenization rejects.
	if (!value || !isAscii(value)) return false;
	const normalized = trimCssWhitespace(value).toLowerCase();
	if (!normalized) return false;
	if (/^#[\da-f]{3}$/i.test(normalized) || /^#[\da-f]{6}$/i.test(normalized)) {
		return true;
	}
	if (OPAQUE_NAMED_COLORS.has(normalized)) return true;

	// A flat body deliberately rules out relative colors, color-mix(), calc(),
	// var(), and any other nested or host-dependent expression.
	const functionMatch = /^([a-z-]+)\(([^()]*)\)$/.exec(normalized);
	if (!functionMatch) return false;
	const [, functionName, body] = functionMatch;
	if (!functionName || body === undefined) return false;

	switch (functionName) {
		case "rgb": {
			if (body.includes(",")) {
				return (
					hasComponents(body, [CSS_NUMBER, CSS_NUMBER, CSS_NUMBER], true) ||
					hasComponents(
						body,
						[CSS_PERCENTAGE, CSS_PERCENTAGE, CSS_PERCENTAGE],
						true,
					)
				);
			}
			return hasComponents(body, [
				CSS_NUMBER_OR_PERCENTAGE,
				CSS_NUMBER_OR_PERCENTAGE,
				CSS_NUMBER_OR_PERCENTAGE,
			]);
		}
		case "hsl":
		case "hwb":
			return hasComponents(
				body,
				[CSS_ANGLE, CSS_PERCENTAGE, CSS_PERCENTAGE],
				functionName === "hsl",
			);
		case "lab":
		case "oklab":
			return hasComponents(body, [
				CSS_NUMBER_OR_PERCENTAGE,
				CSS_NUMBER_OR_PERCENTAGE,
				CSS_NUMBER_OR_PERCENTAGE,
			]);
		case "lch":
		case "oklch":
			return hasComponents(body, [
				CSS_NUMBER_OR_PERCENTAGE,
				CSS_NUMBER_OR_PERCENTAGE,
				CSS_ANGLE,
			]);
		case "color": {
			if (body.includes(",") || body.includes("/")) return false;
			const [space, ...components] =
				trimCssWhitespace(body).split(CSS_WHITESPACE);
			return Boolean(
				space &&
					CSS_COLOR_SPACES.has(space) &&
					components.length === 3 &&
					components.every((component) =>
						CSS_NUMBER_OR_PERCENTAGE.test(component),
					),
			);
		}
		default:
			return false;
	}
}

function createCustomDescriptor(
	scheme: CustomSchemeRecord,
): PieColorSchemeDescriptor {
	const previewVariables = {
		...getBaseThemeVariables("light"),
		...scheme.variables,
	};
	const previewBackground = previewVariables["--pie-background"];
	if (!isStablePreviewColor(previewBackground)) {
		previewVariables["--pie-background"] = "#ffffff";
	}
	for (const token of ["--pie-text", "--pie-primary"] as const) {
		if (!isStablePreviewColor(previewVariables[token])) {
			previewVariables[token] = getBaseThemeVariables("light")[token];
		}
	}
	return Object.freeze({
		id: scheme.id,
		name: scheme.name,
		description: scheme.description,
		kind: "custom" as const,
		preview: createPieColorSchemePreview(previewVariables),
	});
}

function createSnapshot(): ColorSchemeSnapshot {
	return Object.freeze({
		generation,
		schemes: Object.freeze([
			getDefaultColorSchemeDescriptor(),
			...listBuiltInColorSchemeDefinitions().map(
				createBuiltInColorSchemeDescriptor,
			),
			...Array.from(customSchemes.values(), createCustomDescriptor),
		]),
	});
}

let currentSnapshot = createSnapshot();

function warnDiagnostic(diagnostic: PieThemeDiagnostic): void {
	const key = [
		diagnostic.code,
		diagnostic.schemeId ?? "",
		diagnostic.token ?? "",
		diagnostic.message,
	].join("|");
	if (warnedDiagnostics.has(key)) return;
	warnedDiagnostics.add(key);
	console.warn(`[pie-theme] ${diagnostic.message}`);
}

function notifyObservers(snapshot: ColorSchemeSnapshot): void {
	notificationQueue.push(snapshot);
	if (notifying) return;
	notifying = true;
	try {
		while (notificationQueue.length > 0) {
			const next = notificationQueue.shift();
			if (!next) continue;
			for (const listener of [...observers]) {
				try {
					listener(next);
				} catch {
					warnDiagnostic({
						code: "observer-error",
						severity: "warning",
						message: "A color-scheme observer threw while receiving an update.",
					});
				}
			}
		}
	} finally {
		notifying = false;
	}
}

function publishSnapshot(): void {
	generation += 1;
	currentSnapshot = createSnapshot();
	notifyObservers(currentSnapshot);
}

function diagnostic(
	value: PieThemeDiagnostic,
	diagnostics: PieThemeDiagnostic[],
): void {
	diagnostics.push(value);
	warnDiagnostic(value);
}

function normalizeRequestedScheme(value: string | null | undefined): string {
	const normalized = value?.trim();
	return normalized && normalized !== "default" ? normalized : "default";
}

function normalizeExplicitVariables(value: unknown): ThemeVariables {
	if (!value || typeof value !== "object") return {};
	const normalized: ThemeVariables = {};
	for (const [token, rawValue] of Object.entries(
		value as Record<string, unknown>,
	)) {
		if (!token.startsWith("--")) continue;
		if (typeof rawValue === "string" && rawValue.trim()) {
			normalized[token] = rawValue.trim();
		} else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
			normalized[token] = String(rawValue);
		}
	}
	return normalized;
}

function validateRegistration(
	entry: RegisteredPieColorScheme,
	index: number,
): {
	record?: CustomSchemeRecord;
	diagnostics: PieThemeDiagnostic[];
} {
	const diagnostics: PieThemeDiagnostic[] = [];
	if (!entry || typeof entry !== "object") {
		return {
			diagnostics: [
				{
					code: "invalid-registration",
					severity: "error",
					message: `Color-scheme entry ${index} must be an object.`,
					index,
				},
			],
		};
	}

	const id = typeof entry.id === "string" ? entry.id.trim() : "";
	if (!id || /[\s"'<>]/.test(id)) {
		diagnostics.push({
			code: "invalid-scheme-id",
			severity: "error",
			message: `Color-scheme entry ${index} has an invalid id.`,
			index,
			schemeId: id || undefined,
		});
	}
	if (id === "default" || BUILT_IN_IDS.has(id)) {
		diagnostics.push({
			code: "reserved-scheme-id",
			severity: "error",
			message: `Color-scheme id "${id}" is reserved by PIE.`,
			index,
			schemeId: id,
		});
	}

	const variables: ThemeVariables = {};
	if (
		!entry.variables ||
		typeof entry.variables !== "object" ||
		Array.isArray(entry.variables)
	) {
		diagnostics.push({
			code: "empty-scheme",
			severity: "error",
			message: `Color scheme "${id || index}" must define a token overlay.`,
			index,
			schemeId: id || undefined,
		});
	} else {
		for (const [token, rawValue] of Object.entries(entry.variables)) {
			const participation = getSchemeParticipation(token);
			if (!participation) {
				diagnostics.push({
					code: "invalid-token-name",
					severity: "error",
					message: `Color scheme "${id || index}" uses unknown token "${token}".`,
					index,
					schemeId: id || undefined,
					token,
				});
				continue;
			}
			if (participation === "excluded") {
				diagnostics.push({
					code: "excluded-token",
					severity: "error",
					message: `Color scheme "${id || index}" cannot set excluded token "${token}".`,
					index,
					schemeId: id || undefined,
					token,
				});
				continue;
			}
			if (typeof rawValue === "string" && rawValue.trim()) {
				variables[token] = rawValue.trim();
			} else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
				variables[token] = String(rawValue);
			} else {
				diagnostics.push({
					code: "invalid-token-value",
					severity: "error",
					message: `Color scheme "${id || index}" has an invalid value for "${token}".`,
					index,
					schemeId: id || undefined,
					token,
				});
			}
		}
	}

	if (Object.keys(variables).length === 0) {
		diagnostics.push({
			code: "empty-scheme",
			severity: "error",
			message: `Color scheme "${id || index}" must define at least one participating token.`,
			index,
			schemeId: id || undefined,
		});
	}
	if (diagnostics.some((item) => item.severity === "error")) {
		return { diagnostics };
	}

	const existing = customSchemes.get(id);
	if (existing) {
		diagnostics.push({
			code: "custom-scheme-replaced",
			severity: "warning",
			message: `Color scheme "${id}" replaced its previous custom registration.`,
			index,
			schemeId: id,
		});
	}

	return {
		diagnostics,
		record: Object.freeze({
			key: nextRegistrationKey++,
			id,
			name:
				typeof entry.name === "string" && entry.name.trim()
					? entry.name.trim()
					: id,
			description:
				typeof entry.description === "string"
					? entry.description.trim() || undefined
					: undefined,
			variables: freezeVariables(variables),
		}),
	};
}

/** Returns the current deeply immutable catalog snapshot. */
export function listPieColorSchemes(): ColorSchemeSnapshot {
	return currentSnapshot;
}

/** Delivers the current snapshot immediately, then once per registry mutation. */
export function observePieColorSchemes(
	listener: PieThemeObserver,
): Unsubscribe {
	observers.add(listener);
	try {
		listener(currentSnapshot);
	} catch {
		warnDiagnostic({
			code: "observer-error",
			severity: "warning",
			message: "A color-scheme observer threw while receiving an update.",
		});
	}
	let active = true;
	return () => {
		if (!active) return;
		active = false;
		observers.delete(listener);
	};
}

/** Resolves Base Theme → Theme Provider → Scheme → Explicit Theme Override. */
export function resolvePieTheme(
	input: ResolvePieThemeInput = {},
): ThemeResolution {
	const baseTheme = input.baseTheme === "dark" ? "dark" : "light";
	const requestedScheme = normalizeRequestedScheme(input.requestedScheme);
	const providerVariables = normalizePieThemeVariables(input.providerVariables);
	const explicitVariables = normalizeExplicitVariables(input.variables);
	const variables: ThemeVariables = {
		...getBaseThemeVariables(baseTheme),
		...providerVariables,
	};
	// Provider adapters own validation/correction of their own palette. Resolver
	// diagnostics cover managed schemes and explicit per-instance changes.
	const contrastRelevantTokens = new Set<string>();
	let resolvedScheme: PieColorSchemeDescriptor | null = null;
	let status: ThemeResolution["status"] = "default";
	const diagnostics: PieThemeDiagnostic[] = [];

	if (requestedScheme !== "default") {
		const builtIn = getBuiltInColorSchemeDefinition(requestedScheme);
		const custom = customSchemes.get(requestedScheme);
		if (builtIn) {
			// Built-ins completely replace the required accessibility palette.
			// Optional component hooks remain provider-controlled when the built-in
			// deliberately does not define them, matching the CSS adapter cascade.
			Object.assign(variables, builtIn.variables);
			for (const token of Object.keys(builtIn.variables)) {
				contrastRelevantTokens.add(token);
			}
			resolvedScheme = createBuiltInColorSchemeDescriptor(builtIn);
			status = "built-in";
		} else if (custom) {
			// A custom scheme is a palette a host chose for a learner, so fixed
			// component hues collapse into it the way they do for a built-in. The
			// overlay is applied after, so a scheme that wants a hue encoding kept
			// declares `--pie-fixed-hue-collapse: 0%` itself.
			variables["--pie-fixed-hue-collapse"] = "100%";
			Object.assign(variables, custom.variables);
			for (const token of Object.keys(custom.variables)) {
				contrastRelevantTokens.add(token);
			}
			resolvedScheme = createCustomDescriptor(custom);
			status = "custom";
		} else {
			status = "unavailable";
			diagnostics.push({
				code: "unknown-scheme",
				severity: "warning",
				message: `Requested color scheme "${requestedScheme}" is unavailable; the base theme and provider remain active.`,
				schemeId: requestedScheme,
			});
		}
	}

	Object.assign(variables, explicitVariables);
	for (const token of Object.keys(explicitVariables)) {
		contrastRelevantTokens.add(token);
	}
	if (contrastRelevantTokens.size > 0) {
		diagnostics.push(
			...diagnoseThemeContrast(
				variables,
				requestedScheme === "default" ? undefined : requestedScheme,
				contrastRelevantTokens,
			),
		);
	}
	for (const item of diagnostics) warnDiagnostic(item);
	return Object.freeze({
		baseTheme,
		requestedScheme,
		resolvedScheme,
		status,
		variables: freezeVariables(variables),
		diagnostics: freezeDiagnostics(diagnostics),
	});
}

/**
 * Registers valid entries from a batch and returns a generation-aware receipt.
 * Invalid entries never disturb an existing valid registration.
 */
export function registerPieColorSchemes(
	entries: readonly RegisteredPieColorScheme[],
): RegistrationReceipt {
	const diagnostics: PieThemeDiagnostic[] = [];
	const installed = new Map<string, number>();
	if (!Array.isArray(entries)) {
		diagnostic(
			{
				code: "invalid-registration",
				severity: "error",
				message: "Color-scheme registration must be an array.",
			},
			diagnostics,
		);
	} else {
		for (const [index, entry] of entries.entries()) {
			const validated = validateRegistration(entry, index);
			for (const item of validated.diagnostics) {
				diagnostic(item, diagnostics);
			}
			if (!validated.record) continue;
			customSchemes.set(validated.record.id, validated.record);
			installed.set(validated.record.id, validated.record.key);
			const resolved = {
				...getBaseThemeVariables("light"),
				...validated.record.variables,
			};
			for (const item of diagnoseThemeContrast(
				resolved,
				validated.record.id,
				new Set(Object.keys(validated.record.variables)),
			)) {
				diagnostic({ ...item, index }, diagnostics);
			}
		}
	}

	if (installed.size > 0) publishSnapshot();
	let active = true;
	const acceptedSchemeIds = Object.freeze([...installed.keys()]);
	const receipt: RegistrationReceipt = {
		acceptedSchemeIds,
		diagnostics: freezeDiagnostics(diagnostics),
		unregister() {
			if (!active) return;
			active = false;
			let changed = false;
			for (const [id, key] of installed) {
				if (customSchemes.get(id)?.key !== key) continue;
				customSchemes.delete(id);
				changed = true;
			}
			if (changed) publishSnapshot();
		},
	};
	return Object.freeze(receipt);
}
