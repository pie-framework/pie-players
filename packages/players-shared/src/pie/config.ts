/**
 * PIE Config Module
 *
 * Configuration entity manipulation utilities.
 */

import { cloneDeep } from "../object/index.js";
import type {
	ConfigContainerEntity,
	ConfigEntity,
	PieModel,
} from "../types/index.js";
import { parsePackageName } from "./utils.js";
import {
	parseVersionedTagName,
	toPackageVersionedTag,
} from "./versioned-tag.js";

export type PieConfigContractValidationResult = {
	valid: boolean;
	errors: string[];
	warnings: string[];
	/**
	 * Id problems that can bind a model, markup element or session entry to the
	 * wrong partner. They do not invalidate the config, since content that
	 * carries them has always rendered, but the players report them as errors
	 * so they reach instrumentation. Kept apart from `warnings`, which are
	 * advisory.
	 */
	bindingWarnings: string[];
};

const MARKUP_ELEMENT_ID_REGEX =
	/<([a-zA-Z][a-zA-Z0-9._]*-[a-zA-Z0-9._-]*)\b[^>]*?\sid\s*=\s*(["'])(.*?)\2/g;

/** How many PIE elements in the markup carry each `id`. */
function countMarkupElementIds(markup: string): Map<string, number> {
	const counts = new Map<string, number>();
	for (const match of markup.matchAll(MARKUP_ELEMENT_ID_REGEX)) {
		const id = match[3] ?? "";
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	return counts;
}

function collectMarkupElementTags(markup: string): Set<string> {
	const tags = new Set<string>();
	const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9._-]*)(?=[\t\n\f\r />])/g;
	let match: RegExpExecArray | null = null;
	while ((match = tagRegex.exec(markup)) !== null) {
		const tagName = String(match[1] || "").trim();
		if (!tagName) continue;
		// PIE custom elements use custom-element naming (must include a hyphen).
		if (tagName.includes("-")) {
			tags.add(tagName);
		}
	}
	return tags;
}

export const validatePieConfigContract = (
	config: unknown,
): PieConfigContractValidationResult => {
	const errors: string[] = [];
	const warnings: string[] = [];
	const bindingWarnings: string[] = [];
	if (!config || typeof config !== "object" || Array.isArray(config)) {
		return {
			valid: false,
			errors: ["Config must be an object."],
			warnings,
			bindingWarnings,
		};
	}

	const cfg = config as Record<string, unknown>;
	const markup = cfg.markup;
	const elements = cfg.elements;
	const models = cfg.models;

	if (typeof markup !== "string") {
		errors.push("`markup` must be a string.");
	}
	if (!elements || typeof elements !== "object" || Array.isArray(elements)) {
		errors.push("`elements` must be an object.");
	}
	if (!Array.isArray(models)) {
		errors.push("`models` must be an array.");
	}
	if (errors.length > 0) {
		return { valid: false, errors, warnings, bindingWarnings };
	}

	const elementMap = elements as Record<string, unknown>;
	const modelList = models as Array<Record<string, unknown>>;
	const elementTags = Object.keys(elementMap);

	for (const [tagName, packageSpec] of Object.entries(elementMap)) {
		if (typeof tagName !== "string" || tagName.trim().length === 0) {
			errors.push("`elements` contains an empty tag name.");
			continue;
		}
		if (typeof packageSpec !== "string" || packageSpec.trim().length === 0) {
			errors.push(`Element "${tagName}" must map to a non-empty package spec.`);
			continue;
		}
		try {
			toPackageVersionedTag(tagName, packageSpec);
		} catch {
			errors.push(
				`Element "${tagName}" has invalid package spec "${packageSpec}".`,
			);
		}
	}

	// Ids bind models, markup elements and session entries one-to-one, and each
	// binding takes the first match.
	const modelElementTags = new Set<string>();
	const modelIds = new Set<string>();
	for (const [index, model] of modelList.entries()) {
		const modelId = model?.id;
		if (typeof modelId !== "string" || modelId.trim().length === 0) {
			bindingWarnings.push(
				`Model at index ${index} has no valid "id", so no markup element binds to it.`,
			);
		} else if (modelIds.has(modelId)) {
			bindingWarnings.push(
				`Duplicate model id "${modelId}"; the markup element binds to the first model with it.`,
			);
		} else {
			modelIds.add(modelId);
		}
		const modelElement = model?.element;
		if (typeof modelElement !== "string" || modelElement.trim().length === 0) {
			errors.push(
				`Model at index ${index} is missing a valid "element" reference.`,
			);
			continue;
		}
		modelElementTags.add(modelElement);
		if (!(modelElement in elementMap)) {
			errors.push(
				`Model element "${modelElement}" is not declared in \`elements\`.`,
			);
		}
	}

	for (const [id, count] of countMarkupElementIds(markup as string)) {
		if (count > 1) {
			bindingWarnings.push(
				`${count} markup elements share id "${id}"; they bind to one model and one session entry.`,
			);
		}
	}

	const markupElementTags = collectMarkupElementTags(markup as string);
	for (const tagName of markupElementTags) {
		if (!(tagName in elementMap)) {
			errors.push(`Markup tag "${tagName}" is not declared in \`elements\`.`);
		}
	}

	const referencedTags = new Set<string>([
		...modelElementTags,
		...markupElementTags,
	]);
	for (const tagName of elementTags) {
		if (!referencedTags.has(tagName)) {
			warnings.push(
				`Element "${tagName}" is declared in \`elements\` but not referenced by models or markup.`,
			);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		bindingWarnings,
	};
};

export const assertPieConfigContract = (config: unknown): void => {
	const result = validatePieConfigContract(config);
	if (result.valid) return;
	throw new Error(`Invalid PIE config contract: ${result.errors.join(" | ")}`);
};

/**
 * Get all models for a given npm package
 */
export const modelsForPackage = (
	pieContent: ConfigEntity,
	npmPackage: string,
): PieModel[] => {
	if (pieContent && pieContent.models && pieContent.elements && npmPackage) {
		const element = elementForPackage(pieContent, npmPackage);
		return pieContent.models.filter((m) => {
			return element === m.element;
		});
	} else {
		return [];
	}
};

/**
 * Gets the element tag defined for a package.
 * @param pieContent the pie content
 * @param npmPackage npm package name
 */
export const elementForPackage = (
	pieContent: ConfigEntity,
	npmPackage: string,
): string => {
	const elems =
		pieContent && pieContent.elements
			? Object.keys(pieContent.elements).filter((elTag) => {
					const pkg = pieContent.elements[elTag];
					return (
						parsePackageName(npmPackage).name === parsePackageName(pkg).name
					);
				})
			: [];
	if (elems.length > 1) {
		throw new Error("invalid item format: multiple elements for package.");
	} else {
		return elems[0];
	}
};

/**
 * Modify the markup for a package that is present in elements/model but missing from markup,
 * like is the case for rubrics for instance. It does not change the input, but returns a deep
 * copy with the (potentially) modified markup.
 * @param config the pie content
 * @param npmPackage the npm package
 * @param template a callback function for modifying the markup
 */
export const addMarkupForPackage = (
	config: ConfigEntity,
	npmPackage: string,
	template: (id: string, tag: string, markup: string) => string,
): ConfigEntity => {
	if (!config?.markup || !npmPackage) {
		return config;
	}
	const elem = elementForPackage(config, npmPackage);
	if (elem) {
		const model = config.models.find((m) => m.element === elem);
		if (elem && model) {
			const out = cloneDeep(config);
			const match = out.markup.match(new RegExp(elem));
			if (!match) {
				const id = model.id;
				if (id) {
					out.markup = template(id, elem, out.markup);
				}
			}
			return out;
		}
	}
	return config;
};

/**
 * Adds rubric html to markup if the item has a rubric and this is not included in the markup (which would be typical).
 */
export const addRubricIfNeeded = (content: ConfigEntity): ConfigEntity => {
	return addMarkupForPackage(
		cloneDeep(content),
		"@pie-element/rubric",
		(id, tag, markup) => {
			return `
    ${markup}
    <div style='width: 75%'>
      <${tag} id='${id}'></${tag}>
    </div>
    `;
		},
	);
};

/**
 * We make the web component name unique by using the version number because a
 * CustomElementRegistry definition cannot be removed, updated, or replaced. A
 * distinct versioned tag gives each loaded constructor its own effective runtime
 * namespace, allowing several versions of one PIE element to coexist. The same
 * transformation must be applied to the runtime markup and model references.
 */
export const makeUniqueTags = <T extends ConfigContainerEntity>(
	container: T,
): T => {
	// Create mapping of original to versioned names
	const elementMappings = Object.entries(container.config.elements).reduce(
		(acc, [elName, pkg]) => {
			const versionedName = toPackageVersionedTag(elName, pkg as string);
			return {
				...acc,
				[elName]: {
					versionedName,
					package: pkg as string,
				},
			};
		},
		{} as Record<string, { versionedName: string; package: string }>,
	);
	// Transform exact opening/closing tags only. Element names may contain
	// regexp-significant characters, and prefix tags (pie-foo/pie-foo-bar)
	// are separate authored-content contracts.
	const escapeRegExp = (value: string): string =>
		value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const replaceMarkupTag = (
		markup: string,
		originalName: string,
		versionedName: string,
	): string => {
		const exactTag = new RegExp(
			`(<\\/?)${escapeRegExp(originalName)}(?=[\\t\\n\\f\\r />])`,
			"g",
		);
		return markup.replace(
			exactTag,
			(_match, opening: string) => `${opening}${versionedName}`,
		);
	};

	const markup = Object.entries(elementMappings).reduce(
		(currentMarkup, [originalName, { versionedName }]) =>
			originalName !== versionedName
				? replaceMarkupTag(currentMarkup, originalName, versionedName)
				: currentMarkup,
		container.config.markup,
	);

	// Create new elements object
	const elements: Record<string, string> = Object.values(
		elementMappings,
	).reduce(
		(acc, { versionedName, package: pkg }) => ({
			...acc,
			[versionedName]: pkg,
		}),
		{} as Record<string, string>,
	);

	// Update the 'element' property in models to use the versioned name
	const models = container.config.models.map((model) => {
		const originalElement = model.element;
		const mapping = elementMappings[originalElement];

		// If we have a mapping and the element name has changed, update it
		if (mapping && mapping.versionedName !== originalElement) {
			return {
				...model,
				element: mapping.versionedName,
			};
		}

		// Check if the element is already directly referenced in the new elements object
		if (elements[originalElement]) {
			return model;
		}

		// pie-item contract compatibility: makeUniqueTags historically repaired an
		// unversioned model reference when the element map contained a versioned tag.
		// Preserve only the unambiguous case; never guess between multiple versions.
		const baseNameMatches = Object.entries(elementMappings).filter(([key]) => {
			const { baseName, existingEncodedVersion } = parseVersionedTagName(key);
			return (
				existingEncodedVersion !== undefined && baseName === originalElement
			);
		});
		if (baseNameMatches.length === 1) {
			const [, { versionedName }] = baseNameMatches[0];
			return {
				...model,
				element: versionedName,
			};
		}

		// Invalid or ambiguous undeclared model references stay untouched here;
		// validation owns the error.
		return model;
	});

	return {
		...container,
		config: {
			...container.config,
			elements,
			markup,
			models,
		},
	};
};
