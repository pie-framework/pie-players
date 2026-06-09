import type { ConfigEntity } from "@pie-players/pie-players-shared";
import {
	BundleType,
	DEFAULT_BUNDLE_HOST,
	type EnsureRegisteredOptions,
	type ElementMap,
	makeUniqueTags,
} from "@pie-players/pie-players-shared";

export type ControllerInspectionStatus = "loaded" | "missing" | "error";

export type ControllerInspectionRow = {
	modelId: string;
	element: string;
	packageSpec: string;
	status: ControllerInspectionStatus;
	methods: string[];
	error?: string;
};

type ControllerLike = object;

export type ControllerLookup = (elementName: string) => ControllerLike | undefined;

export type ControllerLoadFailureDetails = {
	message: string;
	failedTags?: ReadonlySet<string>;
};

export type EnsureControllersRegistered = (
	elements: ElementMap,
	options: EnsureRegisteredOptions,
) => Promise<void>;

export type LoadControllerInspectionRowsOptions = {
	ensureRegistered: EnsureControllersRegistered;
	lookupController: ControllerLookup;
	bundleHost?: string;
};

export type LoadControllerInspectionRowsResult = {
	rows: ControllerInspectionRow[];
	errorMessage: string | null;
};

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function normalizeController(controller: ControllerLike): ControllerLike {
	if ("default" in controller) {
		const wrapped = (controller as { default?: unknown }).default;
		if (wrapped && typeof wrapped === "object") {
			return wrapped;
		}
	}
	return controller;
}

function methodNames(controller: ControllerLike): string[] {
	const names = new Set<string>();
	let current: object | null = normalizeController(controller);
	while (current && current !== Object.prototype) {
		for (const key of Object.getOwnPropertyNames(current)) {
			if (key === "constructor") continue;
			const descriptor = Object.getOwnPropertyDescriptor(current, key);
			if (typeof descriptor?.value === "function") {
				names.add(key);
			}
		}
		current = Object.getPrototypeOf(current);
	}
	return [...names];
}

export function buildControllerInspectionRows(
	config: Pick<ConfigEntity, "elements" | "models">,
	lookup: ControllerLookup,
	loadFailure?: ControllerLoadFailureDetails,
): ControllerInspectionRow[] {
	return (config.models ?? []).map((model) => {
		const element = typeof model.element === "string" ? model.element : "";
		const baseRow = {
			modelId: String(model.id ?? ""),
			element,
			packageSpec: String(config.elements?.[element] ?? ""),
			methods: [],
		};

		if (loadFailure && (!loadFailure.failedTags || loadFailure.failedTags.has(element))) {
			return {
				...baseRow,
				status: "error",
				error: loadFailure.message,
			};
		}

		try {
			const controller = element ? lookup(element) : undefined;
			if (!controller) {
				return {
					...baseRow,
					status: "missing",
					error: `No controller registered for ${element}`,
				};
			}

			return {
				...baseRow,
				status: "loaded",
				methods: methodNames(controller),
			};
		} catch (error) {
			return {
				...baseRow,
				status: "error",
				error: errorMessage(error),
			};
		}
	});
}

function toLoadFailure(error: unknown): ControllerLoadFailureDetails {
	const maybePartial = error as { unregisteredTags?: unknown };
	const failedTags =
		maybePartial?.unregisteredTags instanceof Set
			? new Set([...maybePartial.unregisteredTags].map(String))
			: undefined;
	return {
		message: errorMessage(error),
		failedTags,
	};
}

export async function loadControllerInspectionRows(
	config: ConfigEntity,
	options: LoadControllerInspectionRowsOptions,
): Promise<LoadControllerInspectionRowsResult> {
	try {
		const transformedConfig = makeUniqueTags({ config }).config;
		await options.ensureRegistered(transformedConfig.elements, {
			backend: {
				kind: "iife",
				bundleHost: options.bundleHost ?? DEFAULT_BUNDLE_HOST,
				bundleType: BundleType.clientPlayer,
				needsControllers: true,
			},
		});

		return {
			rows: buildControllerInspectionRows(
				transformedConfig,
				options.lookupController,
			),
			errorMessage: null,
		};
	} catch (error) {
		const loadFailure = toLoadFailure(error);
		return {
			rows: loadFailure.failedTags
				? buildControllerInspectionRows(
						makeUniqueTags({ config }).config,
						options.lookupController,
						loadFailure,
					)
				: [],
			errorMessage: loadFailure.message,
		};
	}
}
