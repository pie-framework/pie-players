import type {
	ConfigEntity,
	ImageHandler,
	PieController,
	PieModel,
	SoundHandler,
} from "../types/index.js";
import { AssetEventManager } from "./asset-handler.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { findPieController } from "./scoring.js";
import type { AuthoringEnv, ConfigureElement } from "./types.js";
import { parsePackageName } from "./utils.js";

const logger = createPieLogger("authoring", () => isGlobalDebugEnabled());

type RecordValue = Record<string, any>;

export type InitializedConfigureModel = {
	id: string;
	element: string;
	configureTag: string;
	configuration: unknown;
};

export type AuthoringValidationResult = {
	hasErrors: boolean;
	validatedModels: Array<PieModel & { validation?: unknown }>;
};

export type AuthoringMediaHandlers = {
	onInsertImage?: (handler: ImageHandler) => void;
	onDeleteImage?: (src: string, done: (err?: Error) => void) => void;
	onInsertSound?: (handler: SoundHandler) => void;
	onDeleteSound?: (src: string, done: (err?: Error) => void) => void;
};

function isRecord(value: unknown): value is RecordValue {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function packageNameWithoutVersion(packageSpec: string): string {
	try {
		return parsePackageName(packageSpec).name;
	} catch {
		return packageSpec;
	}
}

function packageBaseName(packageName: string): string {
	const lastSegment = packageName.split("/").pop();
	return lastSegment || packageName;
}

function lookupOwn(source: unknown, keys: string[]): unknown {
	if (!isRecord(source)) return undefined;
	for (const key of keys) {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			return source[key];
		}
	}
	return undefined;
}

function mergeConfiguration(deliveryConfig: unknown, authoringConfig: unknown): unknown {
	if (authoringConfig === undefined) {
		return deliveryConfig ?? {};
	}
	if (isRecord(deliveryConfig) && isRecord(authoringConfig)) {
		return {
			...deliveryConfig,
			...authoringConfig,
		};
	}
	return authoringConfig;
}

export function resolveConfigureConfiguration(
	configuration: Record<string, any> | undefined,
	elementTag: string,
	packageSpec: string,
): unknown {
	const versionlessPackageName = packageNameWithoutVersion(packageSpec);
	const basePackageName = packageBaseName(versionlessPackageName);
	const deliveryConfig = lookupOwn(configuration, [
		packageSpec,
		versionlessPackageName,
		elementTag,
	]);
	const authoringConfig = lookupOwn(configuration?.authoring, [
		elementTag,
		packageSpec,
		versionlessPackageName,
		basePackageName,
	]);
	return mergeConfiguration(deliveryConfig, authoringConfig);
}

function findModelForConfigureElement(
	models: PieModel[],
	configureElement: Element,
): PieModel | undefined {
	const modelId = configureElement.id;
	if (!modelId) return undefined;
	return models.find((model) => model.id === modelId);
}

function queryConfigureElements(
	container: Pick<ParentNode, "querySelectorAll">,
	configureTag: string,
): Element[] {
	return Array.from(container.querySelectorAll(configureTag));
}

export function initializeAuthoringConfigures(
	config: ConfigEntity,
	configuration: Record<string, any> = {},
	options: { env: AuthoringEnv; container?: Pick<ParentNode, "querySelectorAll"> },
): InitializedConfigureModel[] {
	const container = options.container ?? document;
	const initializedModels: InitializedConfigureModel[] = [];

	logger.debug("[initializeAuthoringConfigures] Starting initialization");
	logger.debug("[initializeAuthoringConfigures] Config:", config);
	logger.debug("[initializeAuthoringConfigures] Configuration:", configuration);
	logger.debug("[initializeAuthoringConfigures] Env:", options.env);

	if (!config?.elements || !config?.models) {
		logger.warn("[initializeAuthoringConfigures] Invalid config - missing elements or models");
		return initializedModels;
	}

	for (const [elementTag, packageSpec] of Object.entries(config.elements)) {
		const configureTag = `${elementTag}-config`;
		const elements = queryConfigureElements(container, configureTag);

		logger.debug(
			`[initializeAuthoringConfigures] Found ${elements.length} ${configureTag} elements`,
		);

		for (const element of elements) {
			const model = findModelForConfigureElement(config.models, element);

			if (!model) {
				logger.warn(
					`[initializeAuthoringConfigures] No model found for ${configureTag}#${element.id || "(missing-id)"}`,
				);
				continue;
			}

			const configureElement = element as unknown as ConfigureElement;
			const elementConfiguration = resolveConfigureConfiguration(
				configuration,
				elementTag,
				String(packageSpec),
			);

			configureElement.model = model;
			configureElement.configuration = elementConfiguration;

			initializedModels.push({
				id: model.id,
				element: model.element,
				configureTag,
				configuration: elementConfiguration,
			});

			logger.debug(
				`[initializeAuthoringConfigures] Model and configuration set for ${configureTag}#${model.id}`,
				elementConfiguration,
			);
		}
	}

	logger.debug("[initializeAuthoringConfigures] Initialization complete");
	return initializedModels;
}

function resolveValidationController(configureElement: Element): PieController | undefined {
	return findPieController(configureElement.localName);
}

function hasValidationErrors(validation: unknown): boolean {
	if (!validation || typeof validation !== "object") return false;
	const validationRecord = validation as Record<string, unknown>;
	if (validationRecord.hasErrors === true) return true;
	const errors = validationRecord.errors;
	return Array.isArray(errors) && errors.length > 0;
}

export async function validateAuthoringModels(
	config: ConfigEntity,
	configuration: Record<string, any> = {},
	options: { container?: Pick<ParentNode, "querySelectorAll"> } = {},
): Promise<AuthoringValidationResult> {
	const container = options.container ?? document;
	const validatedModels: AuthoringValidationResult["validatedModels"] = [];

	if (!config?.elements || !config?.models) {
		return { hasErrors: false, validatedModels };
	}

	for (const [elementTag, packageSpec] of Object.entries(config.elements)) {
		const configureTag = `${elementTag}-config`;
		const elements = queryConfigureElements(container, configureTag);

		for (const element of elements) {
			const model = findModelForConfigureElement(config.models, element);
			if (!model) continue;

			const controller = resolveValidationController(element);
			const elementConfiguration = resolveConfigureConfiguration(
				configuration,
				elementTag,
				String(packageSpec),
			);
			const validation =
				typeof controller?.validate === "function"
					? await controller.validate(model, elementConfiguration as object)
					: undefined;

			validatedModels.push({
				...model,
				...(isRecord(validation) ? validation : {}),
				id: model.id,
				element: model.element,
				validation,
			});
		}
	}

	return {
		hasErrors: validatedModels.some((model) => hasValidationErrors(model.validation)),
		validatedModels,
	};
}

function toError(value: unknown): Error {
	return value instanceof Error ? value : new Error(String(value ?? "Unknown authoring error"));
}

export function createAuthoringAssetEventManager(
	rootElement: HTMLElement,
	handlers: AuthoringMediaHandlers,
	onHandlerError: (context: string, error: Error) => void,
): AssetEventManager {
	return new AssetEventManager(
		rootElement,
		handlers.onInsertImage
			? (handler) => {
					try {
						handlers.onInsertImage?.(handler);
					} catch (error) {
						const err = toError(error);
						onHandlerError("onInsertImage", err);
						handler.done(err);
					}
				}
			: undefined,
		handlers.onDeleteImage
			? (src, done) => {
					try {
						handlers.onDeleteImage?.(src, done);
					} catch (error) {
						const err = toError(error);
						onHandlerError("onDeleteImage", err);
						done(err);
					}
				}
			: undefined,
		handlers.onInsertSound
			? (handler) => {
					try {
						handlers.onInsertSound?.(handler);
					} catch (error) {
						const err = toError(error);
						onHandlerError("onInsertSound", err);
						handler.done(err);
					}
				}
			: undefined,
		handlers.onDeleteSound
			? (src, done) => {
					try {
						handlers.onDeleteSound?.(src, done);
					} catch (error) {
						const err = toError(error);
						onHandlerError("onDeleteSound", err);
						done(err);
					}
				}
			: undefined,
	);
}
