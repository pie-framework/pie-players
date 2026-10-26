#!/usr/bin/env bun
/**
 * Consume installed tarballs, without workspace aliases: player roots coexist,
 * registration entries define their advertised tags, contracts stay inert, and
 * named runtime exports agree with the shipped declarations. Happy DOM supplies
 * the registry; rendering and accessibility stay with the Playwright suites.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { getImportTarget, splitPackageSpecifier } from "./lib/pack-inspection.mjs";
import {
	collectFixturePackageNames,
	createFixtureProject,
	installTarballs,
	packFixturePackages,
	workspacePackageMap,
} from "./lib/packed-consumer-fixture.mjs";

const PLAYER_ROOTS = [
	"@pie-players/pie-item-player",
	"@pie-players/pie-section-player",
	"@pie-players/pie-assessment-player",
];
const PRINT_ROOT = "@pie-players/pie-print-player";
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const packageDirectory = (fixtureDir, name) => path.join(fixtureDir, "node_modules", ...name.split("/"));

/** Value exports from the installed declarations, including re-exported symbols. */
export function declarationExports(fixtureDir, specifiers) {
	const entries = specifiers.map((specifier) => {
		const { name, subpath } = splitPackageSpecifier(specifier);
		const directory = packageDirectory(fixtureDir, name);
		const manifest = readJson(path.join(directory, "package.json"));
		const target = manifest.exports?.[subpath]?.types ?? (subpath === "." ? manifest.types : undefined);
		if (typeof target !== "string") throw new Error(`${specifier} has no declaration target`);
		return [specifier, path.resolve(directory, target)];
	});
	const program = ts.createProgram(entries.map(([, file]) => file), {
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.NodeNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
		types: [],
		noEmit: true,
	});
	const checker = program.getTypeChecker();
	return new Map(entries.map(([specifier, file]) => {
		const source = program.getSourceFile(file);
		const module = source && checker.getSymbolAtLocation(source);
		if (!module) throw new Error(`${specifier} declarations are missing or not a module: ${file}`);
		const names = checker.getExportsOfModule(module).filter((symbol) => {
			const typeOnly = symbol.declarations?.some((node) =>
				ts.isExportSpecifier(node) && (node.isTypeOnly || node.parent.parent.isTypeOnly),
			);
			const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
			return !typeOnly && Boolean(target.flags & ts.SymbolFlags.Value);
		}).map((symbol) => symbol.name).sort();
		return [specifier, names];
	}));
}

/** Each probe has a fresh module cache and CustomElementRegistry. */
export function probeEntries(fixtureDir, entries, { inert = false, forbiddenTags = [], root = process.cwd() } = {}) {
	const happyDom = pathToFileURL(path.join(root, "packages/section-player/node_modules/@happy-dom/global-registrator/lib/index.js")).href;
	const script = `
import { GlobalRegistrator } from ${JSON.stringify(happyDom)};
import { copyFileSync, rmSync } from "node:fs";
GlobalRegistrator.register();
const definitions = [];
const define = customElements.define;
customElements.define = function (...args) {
 definitions.push(args[0]);
 return define.apply(this, args);
};
for (const entry of ${JSON.stringify(entries)}) {
 const api = await import(entry.specifier);
 // Svelte's component default is an implementation export on existing tool
 // bundles. It is not a named host API; preserve it rather than removing it.
 const actual = Object.keys(api).filter(name => !(entry.componentDefault && name === "default")).sort();
 const expected = entry.exports.filter(name => !(entry.componentDefault && name === "default")).sort();
 if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw Error(entry.specifier + " runtime exports " + JSON.stringify(actual) + " differ from declarations " + JSON.stringify(expected));
 }
 for (const tag of entry.tags) if (!customElements.get(tag)) throw Error(entry.specifier + " did not register " + tag);
 if (entry.duplicate) {
  const constructors = entry.tags.map(tag => [tag, customElements.get(tag)]);
  const original = new URL(import.meta.resolve(entry.specifier));
  const copy = new URL(original);
  copy.pathname += ".pie-ce-consumer-copy.mjs";
  // A separate file forces evaluation in Bun as well as Node; a query-string
  // cache buster is insufficient in Bun. Keep relative chunk imports intact.
  copyFileSync(original, copy);
  try { await import(copy.href); } finally { rmSync(copy, { force: true }); }
  for (const [tag, constructor] of constructors) if (customElements.get(tag) !== constructor) throw Error("A second artifact copy replaced " + tag);
 }
}
if (${inert} && definitions.length) throw Error("Contract imports registered " + definitions.join(", "));
for (const tag of ${JSON.stringify(forbiddenTags)}) if (customElements.get(tag)) throw Error("Targeted entry registered unrelated " + tag);
// NDS is a documented, guarded vendor registration shared by the suite.
const leaked = definitions.filter(tag => !tag.startsWith("pie-") && tag !== "nds-icon-button");
if (leaked.length) throw Error("Unexpected implementation registrations: " + leaked.join(", "));
`;
	try {
		execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
			cwd: fixtureDir,
			env: { ...process.env, NODE_ENV: "production" },
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 30_000,
		});
	} catch (error) {
		throw new Error(`${entries.map((entry) => entry.specifier).join(" -> ")}:\n${error.stderr?.toString().trim() || error.message}`);
	}
}

function registeredTags(fixtureDir, specifier) {
	const { name, subpath } = splitPackageSpecifier(specifier);
	const directory = packageDirectory(fixtureDir, name);
	const manifest = readJson(path.join(directory, "package.json"));
	const target = getImportTarget(manifest, subpath)?.replace(/^\.\//, "");
	if (!manifest.customElements) throw new Error(`${name} has no custom-elements manifest`);
	const cem = readJson(path.join(directory, manifest.customElements));
	const module = cem.modules.find((entry) => entry.path === target);
	const tags = module?.declarations?.filter((entry) => entry.customElement && entry.tagName).map((entry) => entry.tagName) ?? [];
	// This package deliberately registers the shared calculator through its
	// dependency entry, so its own manifest has no local element declaration.
	if (specifier === "@pie-players/pie-tool-calculator-desmos") return ["pie-tool-calculator"];
	if (!tags.length) throw new Error(`${specifier} has no registered tags in its manifest module ${target}`);
	return tags;
}

async function main() {
	const packageMap = workspacePackageMap();
	const toolRoots = [...packageMap.values()].filter(({ dir, pkg }) =>
		/^packages\/(?:tool-|section-player-tools-)/.test(path.relative(process.cwd(), dir)) &&
		pkg.customElements && pkg.exports?.["."],
	).map(({ pkg }) => pkg.name).sort();
	const roots = [...PLAYER_ROOTS, PRINT_ROOT, ...toolRoots];
	const componentEntries = [
		"@pie-players/pie-item-player/components/item-session-debugger-element",
		"@pie-players/pie-section-player/components/section-player-splitpane-element",
		"@pie-players/pie-assessment-player/components/assessment-player-default-element",
		"@pie-players/pie-tool-calculator-shared/calculator-element",
	];
	const sectionPackage = packageMap.get("@pie-players/pie-section-player");
	const contracts = Object.keys(sectionPackage.pkg.exports).filter((key) =>
		key.startsWith("./contracts/") || key === "./policies" || key === "./item-section",
	).map((key) => `${sectionPackage.pkg.name}/${key.slice(2)}`);
	const specifiers = [...roots, ...componentEntries, ...contracts];
	const fixtureDir = createFixtureProject();
	try {
		const packages = collectFixturePackageNames(packageMap, specifiers.map((specifier) => splitPackageSpecifier(specifier).name));
		const tarballs = await packFixturePackages(fixtureDir, packageMap, packages);
		installTarballs(fixtureDir, [...tarballs.values()]);
		const expectedExports = declarationExports(fixtureDir, specifiers);
		const entry = (specifier) => ({
			specifier,
			exports: expectedExports.get(specifier),
			tags: contracts.includes(specifier) ? [] : registeredTags(fixtureDir, specifier),
			componentDefault: toolRoots.includes(specifier),
			duplicate: !contracts.includes(specifier),
		});
		probeEntries(fixtureDir, contracts.map(entry), { inert: true });
		for (const specifier of [...componentEntries, PRINT_ROOT, ...toolRoots]) {
			probeEntries(fixtureDir, [entry(specifier)], {
				forbiddenTags: specifier.includes("item-session-debugger") ? ["pie-item-player"] : [],
			});
		}
		const orders = PLAYER_ROOTS.flatMap((first) => PLAYER_ROOTS.filter((second) => second !== first).map((second) =>
			[first, second, PLAYER_ROOTS.find((third) => third !== first && third !== second)],
		));
		for (const order of orders) probeEntries(fixtureDir, order.map(entry));
		console.log(`[check-ce-composition] OK: installed tarballs pass ${orders.length} player import orders, ${componentEntries.length} component entries, ${toolRoots.length} tool roots, print, ${contracts.length} inert contracts and named runtime/declaration export parity`);
	} finally {
		rmSync(fixtureDir, { recursive: true, force: true });
	}
}

if (import.meta.main) await main();
