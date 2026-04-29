/**
 * PIE Config Module
 *
 * Configuration entity manipulation utilities.
 */

import { cloneDeep } from "../object/index.js";
import type { ConfigContainerEntity, ConfigEntity, PieModel } from "../types/index.js";
import { parsePackageName } from "./utils.js";

export type PieConfigContractValidationResult = {
	valid: boolean;
	errors: string[];
	warnings: string[];
};

function collectMarkupElementTags(markup: string): Set<string> {
	const tags = new Set<string>();
	const tagRegex = /<\/?([a-zA-Z][\w-]*)\b/g;
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
	if (!config || typeof config !== "object" || Array.isArray(config)) {
		return {
			valid: false,
			errors: ["Config must be an object."],
			warnings,
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
		return { valid: false, errors, warnings };
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
			parsePackageName(packageSpec);
		} catch {
			errors.push(`Element "${tagName}" has invalid package spec "${packageSpec}".`);
		}
	}

	const modelElementTags = new Set<string>();
	for (const [index, model] of modelList.entries()) {
		const modelElement = model?.element;
		if (typeof modelElement !== "string" || modelElement.trim().length === 0) {
			errors.push(`Model at index ${index} is missing a valid "element" reference.`);
			continue;
		}
		modelElementTags.add(modelElement);
		if (!(modelElement in elementMap)) {
			errors.push(
				`Model element "${modelElement}" is not declared in \`elements\`.`,
			);
		}
	}

	const markupElementTags = collectMarkupElementTags(markup as string);
	for (const tagName of markupElementTags) {
		if (!(tagName in elementMap)) {
			errors.push(`Markup tag "${tagName}" is not declared in \`elements\`.`);
		}
	}

	const referencedTags = new Set<string>([...modelElementTags, ...markupElementTags]);
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
 * We make the web component name unique by using the version number. This is needed
 * because the spec doesn't allow for removing/ updating a custom element definition
 * once it's been defined. This is a workaround to ensure that the custom element
 * is redefined when the version changes. This requires the same thing to be done
 * in the markup when the item is loaded on the backend, similarly, and in addition
 * to applying sanctioned versions appropriate for the current organization.
 */
export const makeUniqueTags = <T extends ConfigContainerEntity>(
	container: T,
): T => {
	const VERSION_DELIMITER = "--version-";
	const TAG_VERSION_PATTERN = "[0-9A-Za-z-]+";
	const encodeVersionForTag = (version: string): string =>
		version
			.trim()
			.replace(/[.+]/g, "-")
			.replace(/[^0-9A-Za-z-]/g, "-")
			.replace(/-{2,}/g, "-");

	const parseElementName = (
		elName: string,
	): { baseName: string; existingEncodedVersion?: string } => {
		const versionMatch = elName.match(
			new RegExp(`${VERSION_DELIMITER}(${TAG_VERSION_PATTERN})$`),
		);
		return versionMatch
			? {
					baseName: elName.replace(
						`${VERSION_DELIMITER}${versionMatch[1]}`,
						"",
					),
					existingEncodedVersion: versionMatch[1],
				}
			: { baseName: elName };
	};

	const createVersionedName = (elName: string, pkg: string): string => {
		const { baseName, existingEncodedVersion } = parseElementName(elName);
		const { version } = parsePackageName(pkg);
		const targetEncodedVersion = encodeVersionForTag(version);

		if (existingEncodedVersion !== targetEncodedVersion) {
			return `${baseName}${VERSION_DELIMITER}${targetEncodedVersion}`;
		}

		return elName;
	};

	// Create mapping of original to versioned names
	const elementMappings = Object.entries(container.config.elements).reduce(
		(acc, [elName, pkg]) => {
			const versionedName = createVersionedName(elName, pkg as string);
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

	// Transform markup using the mappings
	const markup = Object.entries(elementMappings).reduce(
		(currentMarkup, [originalName, { versionedName }]) =>
			originalName !== versionedName
				? currentMarkup
						.replace(new RegExp(`<${originalName}`, "g"), `<${versionedName}`)
						.replace(new RegExp(`</${originalName}`, "g"), `</${versionedName}`)
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

		// For cases where the model's element isn't in the original elements mapping
		// Try to find by base name (without version)
		const baseNameMatches = Object.entries(elementMappings).filter(([key]) => {
			const { baseName } = parseElementName(key);
			return baseName === originalElement;
		});

		if (baseNameMatches.length > 0) {
			// Use the first match if there are multiple (shouldn't happen in normal usage)
			const [, { versionedName }] = baseNameMatches[0];
			return {
				...model,
				element: versionedName,
			};
		}

		// If we can't find a mapping, keep the original
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
