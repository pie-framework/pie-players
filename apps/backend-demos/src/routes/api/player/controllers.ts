import { createContext, runInContext, type Context } from "node:vm";
import type { DemoItemConfig } from "./db";

export type PieModel = Record<string, unknown> & {
	id: string;
	element: string;
};

export type ControllerModelResult = {
	model: PieModel;
	sessionUpdates: Array<Record<string, unknown>>;
};

export type ControllerOutcomeResult = Record<string, unknown> & {
	id: string;
	element: string;
};

type PieDependency = {
	name: string;
	version: string;
};

type ControllerContext = Context & {
	module: {
		exports: {
			model?: (
				model: PieModel,
				session: Record<string, unknown>,
				env: Record<string, unknown>,
				updateSession?: (
					id: string,
					element: string,
					data: unknown,
				) => Promise<Record<string, unknown>>,
			) => unknown;
			outcome?: (
				model: PieModel,
				session: Record<string, unknown>,
				env: Record<string, unknown>,
			) => unknown;
		};
		result?: unknown;
		sessionUpdates?: Array<Record<string, unknown>>;
		args?: {
			model: PieModel;
			session: Record<string, unknown>;
			env: Record<string, unknown>;
		};
		updateSession?: (
			id: string,
			element: string,
			data: unknown,
		) => Promise<Record<string, unknown>>;
	};
	exports: Record<string, unknown>;
};

const BUILDER_CONTROLLER_BASE_URL =
	"https://builder.pie-api.com/api/v1/controllers";
const CONTROLLER_TIMEOUT_MS = 5_000;
const PRESERVED_DISPLAY_FIELDS = ["promptEnabled"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function preserveDisplayFields(
	rawModel: PieModel,
	controllerResult: Record<string, unknown>,
): Record<string, unknown> {
	const preserved: Record<string, unknown> = {};
	for (const field of PRESERVED_DISPLAY_FIELDS) {
		if (!(field in controllerResult) && field in rawModel) {
			preserved[field] = rawModel[field];
		}
	}
	return preserved;
}

function toPieDependency(packageSpec: string): PieDependency {
	const slashIndex = packageSpec.indexOf("/");
	const atIndex = packageSpec.lastIndexOf("@");
	const hasScopedName = packageSpec.startsWith("@") && slashIndex > 0;
	const versionSeparatorIndex =
		atIndex > (hasScopedName ? slashIndex : 0) ? atIndex : -1;
	if (versionSeparatorIndex < 0) {
		return { name: packageSpec, version: "latest" };
	}
	return {
		name: packageSpec.slice(0, versionSeparatorIndex),
		version: packageSpec.slice(versionSeparatorIndex + 1) || "latest",
	};
}

async function resolveLatestVersion(packageName: string): Promise<string> {
	const response = await fetch(
		`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
	);
	if (!response.ok) {
		throw new Error(
			`Failed to resolve latest version for ${packageName} (${response.status})`,
		);
	}
	const payload = (await response.json()) as { version?: string };
	if (!payload.version) {
		throw new Error(
			`Registry response for ${packageName} did not include a version.`,
		);
	}
	return payload.version;
}

async function resolveDependency(packageSpec: string): Promise<PieDependency> {
	const dependency = toPieDependency(packageSpec);
	if (dependency.version !== "latest") return dependency;
	return {
		...dependency,
		version: await resolveLatestVersion(dependency.name),
	};
}

async function fetchControllerJs(packageSpec: string): Promise<string> {
	const dependency = await resolveDependency(packageSpec);
	const controllerUrl = `${BUILDER_CONTROLLER_BASE_URL}/${dependency.name}@${dependency.version}/controller.js`;
	const response = await fetch(controllerUrl);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch controller for ${dependency.name}@${dependency.version} (${response.status})`,
		);
	}
	return response.text();
}

export function createControllerContext(
	controllerJs: string,
): ControllerContext {
	const sandbox = {
		exports: {},
		module: { exports: {} },
		setTimeout,
		clearTimeout,
		console,
	};
	sandbox.exports = sandbox.module.exports;
	const context = createContext(sandbox) as ControllerContext;
	runInContext(controllerJs, context, { timeout: CONTROLLER_TIMEOUT_MS });
	return context;
}

export async function executeControllerModel(args: {
	controllerJs: string;
	model: PieModel;
	session: Record<string, unknown>;
	env: Record<string, unknown>;
}): Promise<ControllerModelResult> {
	const context = createControllerContext(args.controllerJs);
	if (typeof context.module.exports.model !== "function") {
		throw new Error(
			`No model function found for element ${args.model.element}.`,
		);
	}
	context.module.sessionUpdates = [];
	const updateSession = async (id: string, element: string, data: unknown) => {
		const update = {
			id,
			element,
			...(isRecord(data) ? data : { value: data }),
		};
		context.module.sessionUpdates?.push(update);
		return {};
	};
	context.module.args = {
		model: clone(args.model),
		session: clone(args.session),
		env: clone(args.env),
	};
	context.module.updateSession = updateSession;
	runInContext(
		`module.result = module.exports.model(module.args.model, module.args.session, module.args.env, module.updateSession);`,
		context,
		{ timeout: CONTROLLER_TIMEOUT_MS },
	);
	const result = await Promise.resolve(
		Promise.race([
			Promise.resolve(context.module.result),
			new Promise((_, reject) =>
				setTimeout(
					() => reject(new Error("Controller model() timed out.")),
					CONTROLLER_TIMEOUT_MS,
				),
			),
		]),
	);
	return {
		model: {
			id: args.model.id,
			element: args.model.element,
			...preserveDisplayFields(args.model, isRecord(result) ? result : {}),
			...(isRecord(result) ? result : {}),
		},
		sessionUpdates: context.module.sessionUpdates || [],
	};
}

export async function executeControllerOutcome(args: {
	controllerJs: string;
	model: PieModel;
	session: Record<string, unknown>;
	env: Record<string, unknown>;
}): Promise<ControllerOutcomeResult> {
	const context = createControllerContext(args.controllerJs);
	if (typeof context.module.exports.outcome !== "function") {
		throw new Error(
			`No outcome function found for element ${args.model.element}.`,
		);
	}
	context.module.args = {
		model: clone(args.model),
		session: clone(args.session),
		env: clone(args.env),
	};
	runInContext(
		`module.result = module.exports.outcome(module.args.model, module.args.session, module.args.env);`,
		context,
		{ timeout: CONTROLLER_TIMEOUT_MS },
	);
	const result = await Promise.resolve(
		Promise.race([
			Promise.resolve(context.module.result),
			new Promise((_, reject) =>
				setTimeout(
					() => reject(new Error("Controller outcome() timed out.")),
					CONTROLLER_TIMEOUT_MS,
				),
			),
		]),
	);
	return {
		id: args.model.id,
		element: args.model.element,
		...(isRecord(result) ? result : {}),
	};
}

async function fetchControllers(
	elements: Record<string, string>,
): Promise<Record<string, string>> {
	const entries = await Promise.all(
		Object.entries(elements).map(async ([element, packageSpec]) => [
			element,
			await fetchControllerJs(packageSpec),
		]),
	);
	return Object.fromEntries(entries);
}

function validateConfig(config: DemoItemConfig): void {
	const missing = config.models.filter(
		(model) => !config.elements[model.element],
	);
	if (missing.length > 0) {
		throw new Error(
			`Missing element package for models: ${missing
				.map((model) => `${model.id}:${model.element}`)
				.join(", ")}`,
		);
	}
}

function sessionEntryForModel(
	model: PieModel,
	sessionData: unknown[],
): Record<string, unknown> {
	const entry = sessionData.find(
		(candidate) => isRecord(candidate) && candidate.id === model.id,
	);
	return isRecord(entry)
		? entry
		: {
				id: model.id,
				element: model.element,
			};
}

export async function runModelControllers(args: {
	config: DemoItemConfig;
	sessionData: unknown[];
	env: Record<string, unknown>;
}): Promise<ControllerModelResult[]> {
	validateConfig(args.config);
	const controllers = await fetchControllers(args.config.elements);
	const results: ControllerModelResult[] = [];
	for (const model of args.config.models) {
		results.push(
			await executeControllerModel({
				controllerJs: controllers[model.element],
				model,
				session: sessionEntryForModel(model, args.sessionData),
				env: args.env,
			}),
		);
	}
	return results;
}

export async function runOutcomeControllers(args: {
	config: DemoItemConfig;
	sessionData: unknown[];
	env: Record<string, unknown>;
}): Promise<ControllerOutcomeResult[]> {
	validateConfig(args.config);
	const scoringData = args.sessionData.filter(
		(candidate): candidate is Record<string, unknown> =>
			isRecord(candidate) &&
			typeof candidate.id === "string" &&
			args.config.models.some((model) => model.id === candidate.id),
	);
	if (scoringData.length === 0) return [];
	const controllers = await fetchControllers(args.config.elements);
	const results: ControllerOutcomeResult[] = [];
	for (const data of scoringData) {
		const model = args.config.models.find(
			(candidate) => candidate.id === data.id,
		);
		if (!model) continue;
		results.push(
			await executeControllerOutcome({
				controllerJs: controllers[model.element],
				model,
				session: data,
				env: args.env,
			}),
		);
	}
	return results;
}

export function mergeSessionUpdates(
	sessionData: unknown[],
	updates: Array<Record<string, unknown>>,
): unknown[] {
	if (updates.length === 0) return sessionData;
	const next = [...sessionData];
	for (const update of updates) {
		const index = next.findIndex(
			(entry) => isRecord(entry) && entry.id === update.id,
		);
		if (index >= 0) {
			next[index] = {
				...(isRecord(next[index]) ? next[index] : {}),
				...update,
			};
		} else {
			next.push(update);
		}
	}
	return next;
}
