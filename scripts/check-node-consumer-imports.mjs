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
