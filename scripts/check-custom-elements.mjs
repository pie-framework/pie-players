#!/usr/bin/env node

// Two modes, split by precondition. The default checks package source and
// metadata and needs no build, so it runs in `verify:pre-commit` and ahead of
// the build in the PR gate. `--dist` checks the JS each package publishes and
// must run after `bun run build`. A package with no built JS fails `--dist`
// rather than being skipped: skipping is how the dist checks passed every CI
// run without reading anything, since a fresh checkout has no `dist`.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, "packages");
const INVENTORY_PATH = path.join(ROOT, "docs", "CUSTOM_ELEMENTS_INVENTORY.md");

const hasArg = (flag) => process.argv.includes(flag);
const readText = (filePath) => readFileSync(filePath, "utf8");
const readJson = (filePath) => JSON.parse(readText(filePath));
const rel = (p) => path.relative(ROOT, p).replaceAll("\\", "/");

const walk = (dir, visitor) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (
			entry.name === "node_modules" ||
			entry.name === "dist" ||
			entry.name === ".svelte-kit"
		) {
			continue;
		}
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(fullPath, visitor);
		} else {
			visitor(fullPath);
		}
	}
};

const listFiles = (dir, predicate) => {
	const files = [];
	walk(dir, (filePath) => {
		if (predicate(filePath)) files.push(filePath);
	});
	return files;
};

// Components whose tag is declared by the package entry rather than by
// `svelte:options`. Svelte's own `customElements.define` runs at module scope
// and is unguarded, so a package shipped as a second copy into a page that
// already holds it — a generated `@pie-players/pie-preloaded-player` build
// carries `packages/item-player` — has to register from a function it controls.
// The tag stays discoverable, and the inventory reads it from the entry.
const ENTRY_DECLARED_TAGS = {
	"packages/item-player/src/PieItemPlayer.svelte": {
		entry: "packages/item-player/src/pie-item-player.ts",
		tagPattern: /PIE_ITEM_PLAYER_TAG\s*=\s*["'`]([^"'`]+)["'`]/g,
	},
};

const getTagsFromSvelteFile = (filePath) => {
	const entryDeclared = ENTRY_DECLARED_TAGS[rel(filePath)];
	const src = readText(
		entryDeclared ? path.join(ROOT, entryDeclared.entry) : filePath,
	);
	const tagRegex = entryDeclared
		? new RegExp(entryDeclared.tagPattern)
		: /tag:\s*["'`]([^"'`]+)["'`]/g;
	const tags = [];
	let match = tagRegex.exec(src);
	while (match) {
		tags.push(match[1]);
		match = tagRegex.exec(src);
	}
	return [...new Set(tags)];
};

const discoverCustomElementPackages = () => {
	const discovered = [];
	for (const pkgName of readdirSync(PACKAGES_DIR)) {
		const pkgDir = path.join(PACKAGES_DIR, pkgName);
		const packageJsonPath = path.join(pkgDir, "package.json");
		if (!existsSync(packageJsonPath)) continue;

		const customElementSvelteFiles = [];
		walk(pkgDir, (filePath) => {
			if (!filePath.endsWith(".svelte")) return;
			const src = readText(filePath);
			if (src.includes("customElement={{")) {
				customElementSvelteFiles.push(filePath);
			}
		});

		if (customElementSvelteFiles.length === 0) continue;

		const tags = [
			...new Set(
				customElementSvelteFiles.flatMap((f) => getTagsFromSvelteFile(f)),
			),
		];
		discovered.push({
			pkgDir,
			packageJsonPath,
			customElementSvelteFiles,
			tags,
		});
	}
	return discovered.sort((a, b) => rel(a.pkgDir).localeCompare(rel(b.pkgDir)));
};

const validatePackageSource = (pkgInfo, pkg) => {
	const failures = [];

	const svelteConfigPath = path.join(pkgInfo.pkgDir, "svelte.config.js");
	if (!existsSync(svelteConfigPath)) {
		failures.push('missing "svelte.config.js"');
	} else {
		const configText = readText(svelteConfigPath);
		if (!/customElement\s*:\s*true/.test(configText)) {
			failures.push(
				'"svelte.config.js" must include compilerOptions.customElement: true',
			);
		}
	}

	for (const ceFile of pkgInfo.customElementSvelteFiles) {
		const tags = getTagsFromSvelteFile(ceFile);
		if (tags.length === 0) {
			failures.push(
				`${rel(ceFile)} declares customElement but no tag property was found`,
			);
		}
	}

	if (!pkg?.scripts?.build) {
		failures.push('missing "scripts.build"');
	}
	if (!pkg?.scripts?.check && !pkg?.scripts?.typecheck) {
		failures.push('missing "scripts.check" (or at least "scripts.typecheck")');
	}

	if (!pkg.main) failures.push('missing "main"');
	if (!pkg.exports) failures.push('missing "exports"');
	if (!pkg.unpkg) failures.push('missing "unpkg"');
	if (!pkg.jsdelivr) failures.push('missing "jsdelivr"');

	const files = Array.isArray(pkg.files) ? pkg.files : [];
	const hasDistInFiles = files.some(
		(f) => f === "dist" || f.startsWith("dist/"),
	);
	if (!hasDistInFiles) {
		failures.push('"files" must include dist artifacts');
	}

	return failures;
};

const validatePackageDist = (pkgInfo) => {
	const failures = [];
	const distDir = path.join(pkgInfo.pkgDir, "dist");
	const distJsFiles = existsSync(distDir)
		? listFiles(
				distDir,
				(filePath) => filePath.endsWith(".js") && !filePath.endsWith(".map"),
			)
		: [];
	if (distJsFiles.length === 0) {
		failures.push(
			`no built JS under ${rel(distDir)}; run "bun run build" first`,
		);
	}

	const ceSvelteImportViolations = distJsFiles
		.filter((filePath) => readText(filePath).includes(".svelte?customElement"))
		.map((filePath) => rel(filePath));
	if (ceSvelteImportViolations.length > 0) {
		failures.push(
			`dist JS must not import ".svelte?customElement" (${ceSvelteImportViolations.join(", ")})`,
		);
	}

	// The toolkit / section-player CE build scripts run `svelte.compile()`
	// on each CE entry in isolation and do NOT recursively bundle or copy
	// child `.svelte` imports. Any surviving `.svelte` import in the
	// published dist JS therefore points at a file that does not exist at
	// consumer install time, breaking downstream Vite dep-scan / import
	// resolution. CEs are the primary consumer-facing surface, so guard
	// against regressions here explicitly.
	const danglingSvelteImportRegex =
		/(?:from|import)\s*\(?\s*['"][^'"]+\.svelte(?:\?[^'"]*)?['"]/g;
	const danglingSvelteViolations = [];
	for (const filePath of distJsFiles) {
		const src = readText(filePath);
		const matches = src.match(danglingSvelteImportRegex);
		if (matches && matches.length > 0) {
			danglingSvelteViolations.push(
				`${rel(filePath)} [${[...new Set(matches)].join(", ")}]`,
			);
		}
	}
	if (danglingSvelteViolations.length > 0) {
		failures.push(
			`dist JS must not reference ".svelte" sources at runtime (${danglingSvelteViolations.join("; ")})`,
		);
	}

	return { failures, filesChecked: distJsFiles.length };
};

const writeInventory = (entries) => {
	const lines = [
		"# Custom Elements Inventory",
		"",
		"This file is generated by `scripts/check-custom-elements.mjs --write-inventory`.",
		"",
		"| Package | Tags | CE Svelte Files | Svelte Config | Build Script | Check/Typecheck | npm/CDN Entry Fields |",
		"| --- | --- | --- | --- | --- | --- | --- |",
	];

	for (const entry of entries) {
		const svelteConfigPath = path.join(
			entry.pkgInfo.pkgDir,
			"svelte.config.js",
		);
		const hasSvelteConfig = existsSync(svelteConfigPath);
		const scripts = entry.pkg?.scripts ?? {};
		const hasEntryFields =
			!!entry.pkg?.main &&
			!!entry.pkg?.exports &&
			!!entry.pkg?.unpkg &&
			!!entry.pkg?.jsdelivr;

		lines.push(
			`| \`${entry.pkg?.name ?? rel(entry.pkgInfo.pkgDir)}\` | ${
				entry.pkgInfo.tags.length > 0
					? entry.pkgInfo.tags.map((t) => `\`${t}\``).join(", ")
					: "_none parsed_"
			} | ${entry.pkgInfo.customElementSvelteFiles
				.map((f) => `\`${rel(f)}\``)
				.join("<br/>")} | ${hasSvelteConfig ? "yes" : "no"} | ${
				scripts.build ? "yes" : "no"
			} | ${scripts.check || scripts.typecheck ? "yes" : "no"} | ${
				hasEntryFields ? "yes" : "no"
			} |`,
		);
	}

	writeFileSync(INVENTORY_PATH, `${lines.join("\n")}\n`);
};

const run = () => {
	if (!existsSync(PACKAGES_DIR)) {
		throw new Error(`Packages directory missing: ${PACKAGES_DIR}`);
	}

	const distMode = hasArg("--dist");
	const cePackages = discoverCustomElementPackages();
	if (cePackages.length === 0) {
		console.error(
			"[check-custom-elements] Found no custom-element packages; nothing was validated",
		);
		process.exit(1);
	}

	let distFilesChecked = 0;
	const results = cePackages.map((pkgInfo) => {
		const pkg = readJson(pkgInfo.packageJsonPath);
		if (!distMode) {
			return { pkgInfo, pkg, failures: validatePackageSource(pkgInfo, pkg) };
		}
		const { failures, filesChecked } = validatePackageDist(pkgInfo);
		distFilesChecked += filesChecked;
		return { pkgInfo, pkg, failures };
	});

	if (hasArg("--write-inventory")) {
		writeInventory(results);
		console.log(
			`[check-custom-elements] Wrote inventory: ${rel(INVENTORY_PATH)}`,
		);
	}

	const failing = results.filter((r) => r.failures.length > 0);
	if (failing.length > 0) {
		console.error(
			`[check-custom-elements] Found ${failing.length} package(s) with custom-element compliance issues`,
		);
		for (const f of failing) {
			console.error(
				`\n- ${f.pkg?.name ?? rel(f.pkgInfo.pkgDir)} (${rel(f.pkgInfo.pkgDir)})`,
			);
			for (const issue of f.failures) {
				console.error(`  - ${issue}`);
			}
		}
		process.exit(1);
	}

	console.log(
		distMode
			? `[check-custom-elements] OK: validated ${distFilesChecked} dist JS file(s) across ${results.length} custom-element package(s)`
			: `[check-custom-elements] OK: validated ${results.length} custom-element package(s)`,
	);
};

run();
