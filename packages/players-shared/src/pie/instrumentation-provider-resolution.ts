import { isInstrumentationProvider } from "../instrumentation/provider-guards.js";
import { NewRelicInstrumentationProvider } from "../instrumentation/providers/NewRelicInstrumentationProvider.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";

type UnknownRecord = Record<string, unknown>;
type ProviderCandidate =
	| { kind: "unset" }
	| { kind: "null" }
	| { kind: "value"; value: unknown };

function asRecord(value: unknown): UnknownRecord {
	return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function resolveLoaderConfig(playerLike: unknown): UnknownRecord | null {
	const player = asRecord(playerLike);
	const loaderConfig = asRecord(player.loaderConfig);
	return Object.keys(loaderConfig).length > 0 ? loaderConfig : null;
}

function resolveProviderFromLoaderConfig(loaderConfig: UnknownRecord | null): ProviderCandidate {
	if (!loaderConfig || !("instrumentationProvider" in loaderConfig)) {
		return { kind: "unset" };
	}
	const provider = loaderConfig.instrumentationProvider;
	if (provider === null) return { kind: "null" };
	if (typeof provider === "undefined") return { kind: "unset" };
	return { kind: "value", value: provider };
}

function resolveTrackPageActionsFromLoaderConfig(
	loaderConfig: UnknownRecord | null,
): boolean | undefined {
	if (!loaderConfig || !("trackPageActions" in loaderConfig)) return undefined;
	const trackPageActions = loaderConfig.trackPageActions;
	return typeof trackPageActions === "boolean" ? trackPageActions : undefined;
}

function selectProviderCandidate(
	runtimeCandidate: ProviderCandidate,
	topLevelCandidate: ProviderCandidate,
): ProviderCandidate {
	if (runtimeCandidate.kind === "value" || runtimeCandidate.kind === "null") {
		return runtimeCandidate;
	}
	return topLevelCandidate;
}

let defaultProvider: NewRelicInstrumentationProvider | undefined;
const logger = createPieLogger("instrumentation-provider-resolution", () =>
	isGlobalDebugEnabled(),
);

function getDefaultInstrumentationProvider(): NewRelicInstrumentationProvider {
	if (!defaultProvider) {
		defaultProvider = new NewRelicInstrumentationProvider();
		// New Relic provider sets readiness based on window.newrelic.
		void defaultProvider.initialize();
	}
	return defaultProvider;
}

export function resolveInstrumentationProvider(args: {
	runtimePlayer?: unknown;
	player?: unknown;
	debug?: boolean;
	component?: string;
}): unknown {
	const runtimeLoaderConfig = resolveLoaderConfig(args.runtimePlayer);
	const topLevelLoaderConfig = resolveLoaderConfig(args.player);
	const runtimeTrackPageActions =
		resolveTrackPageActionsFromLoaderConfig(runtimeLoaderConfig);
	const topLevelTrackPageActions =
		resolveTrackPageActionsFromLoaderConfig(topLevelLoaderConfig);
	const trackPageActions =
		runtimeTrackPageActions ?? topLevelTrackPageActions ?? false;
	const candidateProvider = selectProviderCandidate(
		resolveProviderFromLoaderConfig(runtimeLoaderConfig),
		resolveProviderFromLoaderConfig(topLevelLoaderConfig),
	);
	if (candidateProvider.kind === "null") return undefined;
	if (candidateProvider.kind === "unset") {
		return trackPageActions ? getDefaultInstrumentationProvider() : undefined;
	}
	if (isInstrumentationProvider(candidateProvider.value)) {
		return candidateProvider.value;
	}
	if (args.debug) {
		const prefix = args.component ? `[${args.component}] ` : "";
		logger.warn(
			`${prefix}Ignoring invalid instrumentation provider; expected InstrumentationProvider contract`,
		);
	}
	return undefined;
}
