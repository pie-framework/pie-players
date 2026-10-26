#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
	existsSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import {
	getImportTarget,
	getNodeConsumerImportTargets,
	readPublishPolicy,
	splitPackageSpecifier,
} from "./lib/pack-inspection.mjs";

import {
	workspacePackageMap,
	collectFixturePackageNames,
	createFixtureProject,
	installTarballs,
	packFixturePackages,
} from "./lib/packed-consumer-fixture.mjs";

const ROOT = process.cwd();

const policy = readPublishPolicy(ROOT);
const { nodeSafe: NODE_IMPORT_TARGETS, browserOnly: BROWSER_ONLY_TARGETS } =
	getNodeConsumerImportTargets(policy);
const ALL_TARGETS = [...NODE_IMPORT_TARGETS, ...BROWSER_ONLY_TARGETS];
const TTS_SERVER_CORE = "@pie-players/tts-server-core";
const NATIVE_ELEMENT_PACKAGES = [
	"@pie-players/pie-tool-annotation-toolbar",
	"@pie-players/pie-tool-graph",
	"@pie-players/pie-tool-periodic-table",
	"@pie-players/pie-tool-answer-eliminator",
	"@pie-players/pie-tool-theme",
	"@pie-players/pie-tool-line-reader",
	"@pie-players/pie-tool-calculator-shared",
	"@pie-players/pie-tool-calculator-desmos",
	"@pie-players/pie-tool-calculator-inline-desmos",
	"@pie-players/pie-section-player-tools-event-debugger",
	"@pie-players/pie-section-player-tools-instrumentation-debugger",
	"@pie-players/pie-section-player-tools-session-debugger",
	"@pie-players/pie-section-player-tools-tts-settings",
	"@pie-players/pie-section-player-tools-pnp-debugger",

	"@pie-players/pie-tool-ruler",
	"@pie-players/pie-tool-protractor",
	"@pie-players/pie-tool-tts-inline",
	"@pie-players/pie-assessment-player",
];

const isNodeEntryTargetShapeSafe = (target) =>
	target.startsWith("./dist/") &&
	(/\.(mjs|cjs|js)$/.test(target) || target.endsWith("/index"));

const isLikelyBrowserGlobalError = (error) => {
	const message =
		typeof error === "string" ? error : String(error?.message || error || "");
	return /(customElements|window|document|HTMLElement|navigator|Class extends value undefined|superclass is not a constructor)/i.test(
		message,
	);
};

const importSpecifierFromFixture = (fixtureDir, specifier) => {
	const script = `
const target = ${JSON.stringify(specifier)};
try {
	await import(target);
} catch (error) {
	console.error(String(error?.message ?? error));
	process.exit(2);
}
`;
	try {
		execFileSync(process.execPath, ["--input-type=module", "-e", script], {
			cwd: fixtureDir,
			stdio: ["ignore", "pipe", "pipe"],
		});
		return { ok: true, message: "" };
	} catch (error) {
		const message = [
			error?.stderr?.toString(),
			error?.stdout?.toString(),
			error?.message,
		]
			.filter(Boolean)
			.join("\n")
			.trim();
		return { ok: false, message };
	}
};

const typecheckFixture = (fixtureDir, source, compilerOptions) => {
	writeFileSync(path.join(fixtureDir, "index.ts"), source);
	writeFileSync(
		path.join(fixtureDir, "tsconfig.json"),
		`${JSON.stringify(
			{
				compilerOptions: {
					lib: ["ES2022", "DOM", "DOM.Iterable"],
					module: "NodeNext",
					moduleResolution: "NodeNext",
					noEmit: true,
					skipLibCheck: false,
					strict: true,
					target: "ES2022",
					...compilerOptions,
				},
				include: ["index.ts"],
			},
			null,
			2,
		)}\n`,
	);

	try {
		execFileSync(
			path.join(ROOT, "node_modules", ".bin", "tsc"),
			["-p", "tsconfig.json"],
			{
				cwd: fixtureDir,
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		return { ok: true, message: "" };
	} catch (error) {
		return {
			ok: false,
			message: [
				error?.stderr?.toString(),
				error?.stdout?.toString(),
				error?.message,
			]
				.filter(Boolean)
				.join("\n")
				.trim(),
		};
	}
};

const typecheckNativeElements = (fixtureDir) =>
	typecheckFixture(
		fixtureDir,
		`import type { PieToolRulerElement } from "@pie-players/pie-tool-ruler";
import type { PieToolProtractorElement } from "@pie-players/pie-tool-protractor";
import type { PieToolTtsInlineElement } from "@pie-players/pie-tool-tts-inline";
import "@pie-players/pie-section-player/components/section-player-splitpane-element";
import type { PieSectionPlayerElement, PieSectionPlayerSplitPaneElement } from "@pie-players/pie-section-player";
import "@pie-players/pie-assessment-player/components/assessment-player-default-element";
import type { PieAssessmentPlayerDefaultElement } from "@pie-players/pie-assessment-player";

import type { PieToolAnnotationToolbarElement } from "@pie-players/pie-tool-annotation-toolbar";
import type { PieToolGraphElement } from "@pie-players/pie-tool-graph";
import type { PieToolPeriodicTableElement } from "@pie-players/pie-tool-periodic-table";
import type { PieToolAnswerEliminatorElement } from "@pie-players/pie-tool-answer-eliminator";
import type { PieToolThemeElement } from "@pie-players/pie-tool-theme";
import type { PieToolLineReaderElement } from "@pie-players/pie-tool-line-reader";
import type { PieToolCalculatorElement } from "@pie-players/pie-tool-calculator-shared/calculator-element";
import type { PieToolCalculatorElement as DesmosCalculatorElement } from "@pie-players/pie-tool-calculator-desmos";
import type { PieToolCalculatorInlineElement } from "@pie-players/pie-tool-calculator-inline-desmos";
import type { PieSectionPlayerToolsEventDebuggerElement } from "@pie-players/pie-section-player-tools-event-debugger";
import type { PieSectionPlayerToolsInstrumentationDebuggerElement } from "@pie-players/pie-section-player-tools-instrumentation-debugger";
import type { PieSectionPlayerToolsSessionDebuggerElement } from "@pie-players/pie-section-player-tools-session-debugger";
import type { PieSectionPlayerToolsTtsSettingsElement } from "@pie-players/pie-section-player-tools-tts-settings";
import type { PieSectionPlayerToolsPnpDebuggerElement } from "@pie-players/pie-section-player-tools-pnp-debugger";
import type { ToolkitCoordinatorApi } from "@pie-players/pie-assessment-toolkit";

const annotation: PieToolAnnotationToolbarElement = document.createElement("pie-tool-annotation-toolbar");
annotation.enabled = true;
annotation.selectionActions = null;
// @ts-expect-error Component defaults are unavailable before mount.
const initialEnabled: boolean = document.createElement("pie-tool-annotation-toolbar").enabled;
// @ts-expect-error The current toolbar receives selection actions, not a coordinator property.
annotation.highlightCoordinator = {};
const graph: PieToolGraphElement = document.createElement("pie-tool-graph");
graph.visible = true;
graph.toolId = "graph";
// @ts-expect-error Native boolean input must stay typed.
graph.visible = "yes";
const periodic: PieToolPeriodicTableElement = document.createElement("pie-tool-periodic-table");
periodic.visible = true;
periodic.toolId = "periodicTable";
const eliminator: PieToolAnswerEliminatorElement = document.createElement("pie-tool-answer-eliminator");
eliminator.strategy = "mask";
eliminator.buttonAlignment = "inline";
eliminator.elementStateKeys = {};
// @ts-expect-error Only supported eliminator strategies are accepted.
eliminator.strategy = "hide";
const theme: PieToolThemeElement = document.createElement("pie-tool-theme");
theme.visible = true;
theme.toolId = "theme";
const reader: PieToolLineReaderElement = document.createElement("pie-tool-line-reader");
reader.visible = true;
reader.toolId = "lineReader";
const calculator: PieToolCalculatorElement = document.createElement("pie-tool-calculator");
const desmosCalculator: DesmosCalculatorElement = calculator;
desmosCalculator.calculatorType = "scientific";
calculator.availableTypes = ["basic", "graphing"];
calculator.availableTypes = "basic,graphing";
calculator.calculatorConfig = {};
// @ts-expect-error Calculator types come from the provider-neutral contract.
calculator.calculatorType = "finance";
const inlineCalculator: PieToolCalculatorInlineElement = document.createElement("pie-tool-calculator-inline");
inlineCalculator.targetToolId = "calculator";
inlineCalculator.calculatorType = "basic";
inlineCalculator.availableTypes = "basic,scientific";
inlineCalculator.size = "sm";
// @ts-expect-error Only current button sizes are supported.
inlineCalculator.size = "huge";

declare const coordinator: ToolkitCoordinatorApi;
const events: PieSectionPlayerToolsEventDebuggerElement = document.createElement("pie-section-player-tools-event-debugger");
events.toolkitCoordinator = coordinator;
events.sectionId = "section-1";
events.maxEvents = 100;
events.maxEventsByLevel = { item: 50, section: 50 };
events.persistencePanelId = "events";
// @ts-expect-error Event limits are per item/section level, not event type.
events.maxEventsByLevel = { "content-loaded": 10 };
const instrumentation: PieSectionPlayerToolsInstrumentationDebuggerElement = document.createElement("pie-section-player-tools-instrumentation-debugger");
instrumentation.maxRecords = 100;
instrumentation.maxRecordsByKind = { event: 30, metric: 20 };
instrumentation.persistenceScope = "attempt-1";
// @ts-expect-error Record kinds match the instrumentation stream.
instrumentation.maxRecordsByKind = { item: 10 };
const sessions: PieSectionPlayerToolsSessionDebuggerElement = document.createElement("pie-section-player-tools-session-debugger");
sessions.toolkitCoordinator = coordinator;
sessions.sectionId = "section-1";
sessions.attemptId = "attempt-1";
// @ts-expect-error A required component input is still unset on a fresh native element.
const initialSectionId: string = document.createElement("pie-section-player-tools-session-debugger").sectionId;
const settings: PieSectionPlayerToolsTtsSettingsElement = document.createElement("pie-section-player-tools-tts-settings");
settings.toolkitCoordinator = coordinator;
settings.apiEndpoint = "/api/tts";
settings.storageKey = "tts-settings";
settings.customProviders = [];
// @ts-expect-error Current custom providers require their full descriptor.
settings.customProviders = [{ id: "custom" }];
const pnp: PieSectionPlayerToolsPnpDebuggerElement = document.createElement("pie-section-player-tools-pnp-debugger");
pnp.roleType = "candidate";
pnp.sectionData = {};
pnp.editable = false;
// @ts-expect-error Role defaults are unavailable before the component mounts.
const initialRole: "candidate" | "scorer" = document.createElement("pie-section-player-tools-pnp-debugger").roleType;
// @ts-expect-error Preserve the current role contract.
pnp.roleType = "student";
const selectedGraph: PieToolGraphElement | null = document.querySelector("pie-tool-graph");
selectedGraph?.remove();

const ruler: PieToolRulerElement = document.createElement("pie-tool-ruler");
ruler.visible = true;
ruler.toolId = "ruler";
const unmountedRuler = document.createElement("pie-tool-ruler");
// @ts-expect-error Svelte has not supplied the component's defaults before mount.
const initialVisible: boolean = unmountedRuler.visible;
// @ts-expect-error The tool id can also be unset until mount.
const initialToolId: string = unmountedRuler.toolId;
const protractor: PieToolProtractorElement = document.createElement("pie-tool-protractor");
protractor.visible = true;
const tts: PieToolTtsInlineElement = document.createElement("pie-tool-tts-inline");
// @ts-expect-error The base rate default is supplied when the component mounts.
const initialRate: number = tts.baseRate;
tts.speedOptions = [1, { rate: 1.5, ariaLabel: "Fast" }];
tts.baseRate = 0.8;
tts.pitch = 1;
tts.volume = 0.5;
// @ts-expect-error A stale archived property is not part of this element's API.
tts.language = "fr";
// @ts-expect-error Preserve the current speed option contract.
tts.speedOptions = ["fast"];

const section: PieSectionPlayerSplitPaneElement = document.createElement("pie-section-player-splitpane");
section.runtime = { playerType: "preloaded" };
section.sectionId = "section-1";
section.splitPaneInitialPassageWidth = 40;
section.navigateNext();
section.waitForSectionController(10);
const vertical: PieSectionPlayerElement = document.createElement("pie-section-player-vertical");
vertical.navigatePrevious();
document.createElement("pie-section-player-tabbed").getSectionController();
const snapshot = section.getSnapshot();
// @ts-expect-error A layout may have no snapshot before its kernel is bound.
snapshot.composition;
// @ts-expect-error Split-pane settings do not belong to the vertical layout.
vertical.splitPaneInitialPassageWidth = 40;

const assessment: PieAssessmentPlayerDefaultElement = document.createElement("pie-assessment-player-default");
assessment.assessmentId = "assessment-1";
assessment.assessment = null;
assessment.navigateNext();
// @ts-expect-error Implementation state is private.
assessment.controller;
const selected: PieToolRulerElement | null = document.querySelector("pie-tool-ruler");
selected?.remove();
`,
		{ types: [], noUncheckedSideEffectImports: true },
	);

const typecheckToolkitWithoutOptionalPeers = (fixtureDir, optionalPeers) => {
	for (const specifier of optionalPeers) {
		rmSync(path.join(fixtureDir, "node_modules", ...specifier.split("/")), {
			recursive: true,
			force: true,
		});
	}

	return typecheckFixture(
		fixtureDir,
		`import type {
	ToolProviderApi,
	TTSToolProvider,
} from "@pie-players/pie-assessment-toolkit/tools/registration";

export type ToolkitToolProviders = [ToolProviderApi, TTSToolProvider];
`,
		{ types: [] },
	);
};

/**
 * The server TTS declarations use no Node types, and the package installs none:
 * `@types/node` is included in every compilation that can see it, so one pulled
 * in by a dependency breaks a consumer on an older TypeScript. The package
 * installs into a fixture of its own, since other fixture packages bring
 * `@types/node` in transitively. The snippet encodes the bytes the way a route
 * handler does, which the audio type has to keep compiling without Node types.
 */
const typecheckTtsServerCore = (tarballPath) => {
	const fixtureDir = createFixtureProject();
	try {
		installTarballs(fixtureDir, [tarballPath]);
		if (existsSync(path.join(fixtureDir, "node_modules", "@types", "node"))) {
			return { ok: false, message: "installing it installs @types/node" };
		}
		return typecheckFixture(
			fixtureDir,
			`import type { SynthesizeResponse } from "${TTS_SERVER_CORE}";

export const toBase64 = (response: SynthesizeResponse): string =>
	typeof response.audio === "string"
		? response.audio
		: response.audio.toString("base64");
`,
			{ types: [] },
		);
	} finally {
		rmSync(fixtureDir, { recursive: true, force: true });
	}
};

const run = async () => {
	const packageMap = workspacePackageMap();
	const failures = [];
	for (const specifier of ALL_TARGETS) {
		const { name, subpath } = splitPackageSpecifier(specifier);
		const entry = packageMap.get(name);
		if (!entry) {
			failures.push(`[node-consumer] missing workspace package: ${name}`);
			continue;
		}
		const importTarget = getImportTarget(entry.pkg, subpath);
		if (!importTarget) {
			failures.push(`[node-consumer] ${specifier} has no import target`);
			continue;
		}
		if (!isNodeEntryTargetShapeSafe(importTarget)) {
			failures.push(
				`[node-consumer] ${specifier} has non-node-safe target shape: ${importTarget}`,
			);
			continue;
		}
		const absTarget = path.join(entry.dir, importTarget);
		if (!existsSync(absTarget)) {
			failures.push(
				`[node-consumer] ${specifier} missing built import target: ${importTarget}`,
			);
			continue;
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-node-consumer-imports] Found ${failures.length} workspace preflight issue(s)`,
		);
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		process.exit(1);
	}

	const fixturePackageNames = collectFixturePackageNames(packageMap, [
		...ALL_TARGETS.map((specifier) => splitPackageSpecifier(specifier).name),
		...NATIVE_ELEMENT_PACKAGES,
		TTS_SERVER_CORE,
	]);
	let ttsServerCoreTarball = "";
	let fixtureDir = "";

	try {
		fixtureDir = createFixtureProject();
		const tarballs = await packFixturePackages(fixtureDir, packageMap, fixturePackageNames);
		ttsServerCoreTarball = tarballs.get(TTS_SERVER_CORE);
		installTarballs(fixtureDir, [...tarballs.values()]);

		for (const specifier of NODE_IMPORT_TARGETS) {
			const result = importSpecifierFromFixture(fixtureDir, specifier);
			if (!result.ok) {
				failures.push(
					`[node-consumer] ${specifier} failed Node import from node_modules: ${result.message}`,
				);
			}
		}

		for (const specifier of BROWSER_ONLY_TARGETS) {
			const result = importSpecifierFromFixture(fixtureDir, specifier);
			if (result.ok) {
				failures.push(
					`[node-consumer] ${specifier} unexpectedly imported in plain Node from node_modules`,
				);
				continue;
			}
			if (!isLikelyBrowserGlobalError(result.message)) {
				failures.push(
					`[node-consumer] ${specifier} failed with unexpected Node error from node_modules: ${result.message}`,
				);
			}
		}

		const ttsTypecheckResult = typecheckTtsServerCore(ttsServerCoreTarball);
		if (!ttsTypecheckResult.ok) {
			failures.push(
				`[node-consumer] ${TTS_SERVER_CORE} failed TypeScript consumption without Node types: ${ttsTypecheckResult.message}`,
			);
		}

		const toolkitPackageName = "@pie-players/pie-assessment-toolkit";
		const toolkitPackage = packageMap.get(toolkitPackageName)?.pkg;
		const optionalToolkitPeers = Object.keys(
			toolkitPackage?.peerDependenciesMeta || {},
		).filter(
			(peerName) =>
				toolkitPackage.peerDependenciesMeta[peerName]?.optional === true,
		);
		const typecheckResult = typecheckToolkitWithoutOptionalPeers(
			fixtureDir,
			optionalToolkitPeers,
		);
		if (!typecheckResult.ok) {
			failures.push(
				`[node-consumer] ${toolkitPackageName}/tools/registration failed TypeScript consumption without optional peers: ${typecheckResult.message}`,
			);
		}
		const nativeElementResult = typecheckNativeElements(fixtureDir);
		if (!nativeElementResult.ok) {
			failures.push(
				`[node-consumer] native custom elements failed TypeScript consumption: ${nativeElementResult.message}`,
			);
		}
	} catch (error) {
		failures.push(
			`[node-consumer] fixture setup failed: ${error?.stderr?.toString?.()?.trim?.() || error?.message || error}`,
		);
	} finally {
		if (fixtureDir) {
			rmSync(fixtureDir, { recursive: true, force: true });
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-node-consumer-imports] Found ${failures.length} Node consumer import issue(s)`,
		);
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		process.exit(1);
	}

	console.log(
		`[check-node-consumer-imports] OK: validated ${NODE_IMPORT_TARGETS.length} Node-import targets and ${BROWSER_ONLY_TARGETS.length} browser-only boundaries and native element typings from installed node_modules packages`,
	);
};

await run();
