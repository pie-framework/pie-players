import { cloneDeep } from "@pie-players/pie-players-shared/object";
import { parsePackageName } from "@pie-players/pie-players-shared/pie/utils";
import {
	getPackageWithoutVersion,
	type PieContent,
	pieShortIdGenerator,
} from "./legacy-utils.js";

export const COMPLEX_RUBRIC = "complex-rubric";

const elementsHasPackage = (
	elements: Record<string, string>,
	npmPackage: string,
) => {
	if (!elements) return false;
	const packageToFind = parsePackageName(npmPackage).name;
	return Object.values(elements).some(
		(val) => packageToFind === parsePackageName(val).name,
	);
};

const elementForPackage = (
	pieContent: PieContent,
	npmPackage: string,
): string => {
	const elems = pieContent?.elements
		? Object.keys(pieContent.elements).filter((elTag) => {
				const pkg = pieContent.elements[elTag];
				return parsePackageName(npmPackage).name === parsePackageName(pkg).name;
			})
		: [];
	if (elems.length > 1)
		throw new Error("invalid item format: multiple elements for package.");
	return elems[0];
};

const modelsForPackage = (
	pieContent: PieContent,
	npmPackage: string,
): any[] => {
	if (pieContent?.models && pieContent?.elements && npmPackage) {
		const el = elementForPackage(pieContent, npmPackage);
		return pieContent.models.filter((m: any) => m.element === el);
	}
	return [];
};

export const addMarkupForPackage = (
	content: PieContent,
	npmPackage: string,
	template: (id: string, tag: string, markup: string) => string,
): PieContent => {
	const out = cloneDeep(content);
	const elem = out && elementForPackage(out, npmPackage);
	if (elem && modelsForPackage(out, npmPackage).length > 0) {
		const match = out.markup?.match(new RegExp(elem));
		if (out.markup != null && !match) {
			const id =
				out.models && out.models.find((m: any) => m.element === elem)?.id;
			if (id) out.markup = template(id, elem, out.markup);
		}
	}
	return out;
};

export const complexRubricChecks = (
	content: PieContent,
	configSettings: any = {},
) => {
	const elements = content.elements || {};
	const elementKeys = Object.keys(elements);
	const elementValues = Object.values(elements).map((v) =>
		getPackageWithoutVersion(v),
	);
	const complexRubricElements = elementKeys.filter(
		(key) => elements[key] && elements[key].includes(COMPLEX_RUBRIC),
	);
	const complexRubricModels = (content.models || []).filter((m: any) =>
		String(m.element).includes(COMPLEX_RUBRIC),
	);

	// If config ONLY has complex-rubrics, do nothing (legacy special-case).
	if (complexRubricElements.length === elementKeys.length) return {};

	let shouldHaveComplexRubric = !!(content.models || []).filter(
		(m: any) => m.rubricEnabled,
	).length;

	const shouldForceEnable = (cfg: any) =>
		cfg && cfg.withRubric && cfg.withRubric.forceEnabled;
	const shouldHaveForced = !!elementValues.filter((k) =>
		shouldForceEnable(configSettings[k]),
	).length;

	shouldHaveComplexRubric = shouldHaveComplexRubric || shouldHaveForced;

	return {
		shouldAddComplexRubric:
			shouldHaveComplexRubric && !complexRubricModels.length,
		shouldRemoveComplexRubric:
			!shouldHaveComplexRubric && !!complexRubricModels.length,
		complexRubricElements,
	};
};

export const removeComplexRubricFromMarkup = (
	content: PieContent,
	complexRubricElements: string[],
	doc: Document,
): {
	markupWithoutComplexRubric: string;
	deletedComplexRubricItemIds: string[];
} => {
	const tempDiv = doc.createElement("div");
	tempDiv.innerHTML = content.markup;
	const elsWithId = tempDiv.querySelectorAll("[id]");
	const deletedComplexRubricItemIds: string[] = [];

	elsWithId.forEach((el) => {
		const pieElName = el.tagName.toLowerCase().split("-config")[0];
		if (complexRubricElements.includes(pieElName)) {
			deletedComplexRubricItemIds.push((el as HTMLElement).id);
			try {
				tempDiv.querySelector(`#${(el as HTMLElement).id}`)?.remove();
			} catch {}
		}
	});

	const newMarkup = tempDiv.innerHTML;
	tempDiv.remove();
	return { markupWithoutComplexRubric: newMarkup, deletedComplexRubricItemIds };
};

export const addComplexRubric = (content: PieContent): PieContent =>
	addMarkupForPackage(
		cloneDeep(content),
		`@pie-element/${COMPLEX_RUBRIC}`,
		(id, tag, markup) => {
			return `${markup}<${tag} id="${id}"></${tag}>`;
		},
	);

export const addRubric = (content: PieContent): PieContent =>
	addMarkupForPackage(
		cloneDeep(content),
		"@pie-element/rubric",
		(id, tag, markup) => {
			return `
    ${markup}
    <div style="width: 75%">
      <${tag} id="${id}"></${tag}>
    </div>
    `;
		},
	);

export const addMultiTraitRubric = (content: PieContent): PieContent =>
	addMarkupForPackage(
		cloneDeep(content),
		"@pie-element/multi-trait-rubric",
		(id, tag, markup) => {
			return `
    ${markup}
    <div style="margin-top: 20px;">
      <${tag} id="${id}"></${tag}>
    </div>
    `;
		},
	);

export const addPackageToContent = (
	content: PieContent,
	packageToAdd: string,
	model?: any,
) => {
	if (packageToAdd && !elementsHasPackage(content.elements, packageToAdd)) {
		model = model ?? {};
		model.id = pieShortIdGenerator();
		const elementName = pieShortIdGenerator();
		model.element = elementName;
		content.models && content.models.push(model);
		content.elements && (content.elements[elementName] = packageToAdd);
		return content;
	}
	return null;
};
