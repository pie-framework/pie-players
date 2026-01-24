import { cloneDeep } from "@pie-framework/pie-players-shared/object";
import { parsePackageName } from "@pie-framework/pie-players-shared/pie/utils";

// Legacy: prefix new tag with pp- for pie player and to ensure custom element validity
export const createTag = (npmPkg: string) =>
	`pp-${packageToElementName(npmPkg)}`;

export const packageToElementName = (npmPackage: string): string => {
	const parsed = parsePackageName(npmPackage);
	let tag = parsed.name.replace(/\/|\./g, "-");
	tag = tag.replace("@", "");
	return tag;
};

export const getPackageWithoutVersion = (packages: string): string =>
	packages
		.split("+")
		.map((p) => parsePackageName(p).name)
		.join("+");

export const pieShortIdGenerator = () => {
	const s4 = () =>
		(((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
	return `p-${s4()}${s4()}`;
};

export type PieContent = {
	id?: string;
	elements: Record<string, string>;
	models: any[];
	markup: string;
	bundle?: any;
};

export type AdvancedItemConfig = {
	id?: string;
	pie: PieContent;
	passage?: PieContent;
};

/**
 * Replaces all user-defined element name mappings with ones derived from
 * the NPM package name (legacy `pp-...` tags).
 */
export const normalizeContentElements = (content: PieContent): PieContent => {
	if (!content || !content.elements) return content;
	let markup = content.markup;

	for (const key of Object.keys(content.elements)) {
		const tag = key;
		const npmPkg = content.elements[key];
		const newTag = createTag(npmPkg);

		// Replace open/close tags only (avoid replacing text)
		markup = markup
			.split(`<${tag}`)
			.join(`<${newTag}`)
			.split(`</${tag}`)
			.join(`</${newTag}`);

		if (content.models) {
			content.models.forEach((model: any) => {
				if (model.element === key) model.element = newTag;
			});
		}

		if (key !== newTag) {
			content.elements[newTag] = npmPkg;
			delete content.elements[key];
		}
	}

	content.markup = markup;
	return content;
};

export const pieContentFromConfig = (config: any): PieContent | null => {
	try {
		if (typeof config === "string") config = JSON.parse(config);
		if (config?.pie) {
			const ac = config as AdvancedItemConfig;
			return normalizeContentElements(cloneDeep(ac.pie));
		}
		if (config?.elements) {
			return normalizeContentElements(cloneDeep(config as PieContent));
		}
		return null;
	} catch {
		return null;
	}
};

/**
 * Best-effort conversion back to the caller-provided shape.
 * - If the input was an advanced config (had `pie`), return `{...input, pie: updated}`
 * - Else return the updated pie content directly
 */
export const mergePieContentBackIntoConfig = (
	original: any,
	updated: PieContent,
) => {
	if (original && typeof original === "object" && "pie" in original) {
		return { ...(original as any), pie: updated };
	}
	return updated;
};
