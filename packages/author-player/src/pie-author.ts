import { IifePieLoader } from "@pie-players/pie-players-shared/pie/iife-loader";
import { pieRegistry } from "@pie-players/pie-players-shared/pie/registry";
import { validateCustomElementTag } from "@pie-players/pie-players-shared/pie/tag-names";
import { BundleType } from "@pie-players/pie-players-shared/pie/types";
import { parsePackageName } from "@pie-players/pie-players-shared/pie/utils";
import { pieContentFromConfig } from "./legacy-utils.js";
import PieAuthor from "./PieAuthor.svelte";
import {
	addMultiTraitRubric,
	addPackageToContent,
	addRubric,
} from "./rubric-utils.js";

export interface PieAuthorElement extends HTMLElement {
	config: unknown;
	addPreview?: boolean;
	addRubric?: boolean;
	bundleHost?: string;
	bundleEndpoints?: unknown;
	disableBundler?: boolean;
	configSettings?: Record<string, any>;
	imageSupport?: unknown;
	uploadSoundSupport?: unknown;
	version?: string;
	defaultComplexRubricModel?: unknown;
	isInsidePieApiAuthor?: boolean;
	reFetchBundle?: boolean;
	/**
	 * Legacy API
	 */
	addRubricToConfig?: (config: unknown, rubricModel?: any) => Promise<any>;
	addMultiTraitRubricToConfig?: (
		config: unknown,
		multiTraitRubricModel?: any,
	) => Promise<any>;
	validateModels?: () => Promise<{
		hasErrors: boolean;
		validatedModels: Record<string, any>;
	}>;
}

export function definePieAuthor(tagName = "pie-author") {
	const validTagName = validateCustomElementTag(tagName, "pie-author tagName");
	if (!customElements.get(validTagName)) {
		customElements.define(
			validTagName,
			PieAuthor as unknown as CustomElementConstructor,
		);
	}
	attachLegacyMethods(validTagName);
}

function resolveBundleHost(el: PieAuthorElement): string {
	const DEFAULT_ENDPOINTS = {
		prod: { buildServiceBase: "https://proxy.pie-api.com/bundles/" },
		stage: { buildServiceBase: "https://proxy.pie-api.com/bundles/" },
		dev: { buildServiceBase: "https://proxy.dev.pie-api.com/bundles/" },
	} as const;

	const bundleEndpoints = el.bundleEndpoints as any;
	if (bundleEndpoints?.buildServiceBase)
		return String(bundleEndpoints.buildServiceBase);

	const bundleHost = el.bundleHost as any;
	if (bundleHost && ["dev", "stage", "prod"].includes(String(bundleHost))) {
		return DEFAULT_ENDPOINTS[String(bundleHost) as "dev" | "stage" | "prod"]
			.buildServiceBase;
	}
	if (bundleHost && String(bundleHost).startsWith("http"))
		return String(bundleHost);
	return DEFAULT_ENDPOINTS.prod.buildServiceBase;
}

function isEmptyObjectLike(v: any): boolean {
	if (v == null) return true;
	if (Array.isArray(v)) return v.length === 0;
	if (typeof v !== "object") return false;
	return Object.keys(v).length === 0;
}

function attachLegacyMethods(tagName: string) {
	const Ctor = customElements.get(tagName) as any;
	if (!Ctor?.prototype) return;

	// addRubricToConfig (legacy @Method)
	if (!Ctor.prototype.addRubricToConfig) {
		Ctor.prototype.addRubricToConfig = async function addRubricToConfig(
			config: unknown,
			rubricModel?: any,
		) {
			// Mirrors legacy behavior: warn + best-effort defaults.
			// eslint-disable-next-line no-console
			console.warn(
				"If you are using complex-rubric, stop using this function to prevent having duplicated rubrics.",
			);
			const content = pieContentFromConfig(config);
			if (!content) return null;

			const model =
				rubricModel ??
				({
					id: "rubric",
					element: "pie-rubric",
					points: ["", "", "", ""],
					maxPoints: 4,
					excludeZero: false,
				} as any);

			addPackageToContent(content, "@pie-element/rubric", model);
			return addRubric(content);
		};
	}

	// addMultiTraitRubricToConfig (legacy @Method)
	if (!Ctor.prototype.addMultiTraitRubricToConfig) {
		Ctor.prototype.addMultiTraitRubricToConfig =
			async function addMultiTraitRubricToConfig(
				config: unknown,
				multiTraitRubricModel?: any,
			) {
				// eslint-disable-next-line no-console
				console.warn(
					"If you are using complex-rubric, stop using this function to prevent having duplicated rubrics.",
				);
				const content = pieContentFromConfig(config);
				if (!content) return null;

				const model =
					multiTraitRubricModel ??
					({
						id: "multi-trait-rubric",
						element: "pie-multi-trait-rubric",
						visibleToStudent: true,
						halfScoring: false,
						excludeZero: true,
						pointLabels: true,
						description: false,
						standards: false,
						scales: [
							{
								maxPoints: 4,
								scorePointsLabels: ["", "", "", ""],
								traitLabel: "Trait",
								traits: [
									{
										name: "",
										standards: [],
										description: "",
										scorePointsDescriptors: ["", "", "", "", ""],
									},
								],
							},
						],
					} as any);

				addPackageToContent(content, "@pie-element/multi-trait-rubric", model);
				return addMultiTraitRubric(content);
			};
	}

	// validateModels (legacy @Method) - best-effort parity:
	// Loads controllers (client-player bundle) on-demand and calls controller.validate(model, configuration)
	if (!Ctor.prototype.validateModels) {
		Ctor.prototype.validateModels = async function validateModels() {
			const el = this as PieAuthorElement;
			const currentConfig = (el as any).config;
			const content = pieContentFromConfig(currentConfig);
			if (!content?.models) return { hasErrors: false, validatedModels: {} };

			if (!(el as any).disableBundler) {
				const loader = new IifePieLoader({
					bundleHost: resolveBundleHost(el),
					reFetchBundle: Boolean((el as any).reFetchBundle),
					whenDefinedTimeoutMs: 5000,
				});
				// Load controllers (and base elements) needed for validation.
				await loader.load(content, document, BundleType.clientPlayer, true);
			}

			const configSettings = ((el as any).configSettings ?? {}) as Record<
				string,
				any
			>;

			let hasErrors = false;
			const validatedModels: Record<string, any> = {};

			for (const model of content.models || []) {
				const tag = model?.element;
				const pkg = tag ? content.elements?.[tag] : null;
				const pkgName = pkg ? parsePackageName(pkg).name : null;
				const configuration = (pkgName && configSettings[pkgName]) || {};

				// Controller may be registered under the base tag name.
				const controller = tag ? pieRegistry()[tag]?.controller : null;

				const errors =
					controller && typeof controller.validate === "function"
						? controller.validate(model, configuration)
						: undefined;

				if (errors && !isEmptyObjectLike(errors)) hasErrors = true;
				validatedModels[model.id] = errors ? { ...model, errors } : model;
			}

			return { hasErrors, validatedModels };
		};
	}
}

// Side-effect define for convenience
definePieAuthor();
