import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const toPosix = (value) =>
	value.replaceAll(path.sep, "/").replaceAll("\\", "/");

export const readJson = async (filePath) =>
	JSON.parse(await readFile(filePath, "utf8"));

export const readJsonSync = (filePath) =>
	JSON.parse(readFileSync(filePath, "utf8"));

const elementWorkspaceCandidates = ["elements-react", "elements-svelte"];

export function findElementPackageDir(pieElementsNgRoot, slug) {
	for (const workspace of elementWorkspaceCandidates) {
		const packageDir = path.join(
			pieElementsNgRoot,
			"packages",
			workspace,
			slug,
		);
		if (existsSync(path.join(packageDir, "package.json"))) {
			return packageDir;
		}
	}
	return null;
}

export function inferElementKind(packageDir) {
	const normalized = toPosix(packageDir);
	if (normalized.includes("/packages/elements-svelte/")) return "svelte";
	if (normalized.includes("/packages/elements-react/")) return "react";
	return "unknown";
}

export function collectBrowserViews(pkg) {
	const views = [];
	for (const [key, value] of Object.entries(pkg.exports ?? {})) {
		const match = /^\.\/browser\/([^/]+)$/.exec(key);
		if (!match) continue;
		const target = typeof value === "string" ? value : value?.default;
		if (typeof target !== "string") continue;
		views.push({ view: match[1], exportKey: key, target });
	}
	return views.sort((a, b) => a.view.localeCompare(b.view));
}

export async function listPublishableElementSlugs(pieElementsNgRoot) {
	const slugs = [];
	for (const workspace of elementWorkspaceCandidates) {
		const workspaceDir = path.join(pieElementsNgRoot, "packages", workspace);
		const entries = await readdir(workspaceDir, { withFileTypes: true }).catch(
			() => [],
		);
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const packageDir = path.join(workspaceDir, entry.name);
			const packageJson = path.join(packageDir, "package.json");
			if (!existsSync(packageJson)) continue;
			const pkg = readJsonSync(packageJson);
			if (pkg.private === true || !pkg.name?.startsWith("@pie-element/")) {
				continue;
			}
			slugs.push(entry.name);
		}
	}
	return slugs.sort();
}

export async function loadSampleForSlug(pieElementsNgRoot, slug) {
	const samplePath = path.join(
		pieElementsNgRoot,
		"apps",
		"element-demo",
		"src",
		"lib",
		"samples",
		`${slug}.json`,
	);
	if (!existsSync(samplePath)) {
		return {
			fixtureId: null,
			elementTag: slug,
			model: { id: "1", element: slug },
			session: { id: "1", element: slug },
			markup: `<${slug} id="1"></${slug}>`,
			registrationOnly: true,
			samplePath,
		};
	}

	const sample = await readJson(samplePath);
	const demo = (sample.demos ?? []).find(
		(candidate) => candidate?.model && typeof candidate.model.id === "string",
	);
	if (!demo) {
		return {
			fixtureId: null,
			elementTag: slug,
			model: { id: "1", element: slug },
			session: { id: "1", element: slug },
			markup: `<${slug} id="1"></${slug}>`,
			registrationOnly: true,
			samplePath,
		};
	}

	const elementTag =
		typeof demo.model.element === "string" && demo.model.element.length > 0
			? demo.model.element
			: slug;
	const model =
		typeof demo.model.element === "string" && demo.model.element.length > 0
			? demo.model
			: { ...demo.model, element: elementTag };
	const rawSession = demo.session ?? { id: demo.model.id, element: elementTag };
	const session =
		typeof rawSession.element === "string" && rawSession.element.length > 0
			? rawSession
			: { ...rawSession, element: elementTag };
	return {
		fixtureId: demo.id ?? null,
		elementTag,
		model,
		session,
		markup: `<${elementTag} id="${demo.model.id}"></${elementTag}>`,
		registrationOnly: false,
		samplePath,
	};
}

function blockedEntries(report) {
	const unsupported = report.browserEsmUnsupported ?? {};
	if (Array.isArray(unsupported)) return unsupported;
	if (unsupported && typeof unsupported === "object")
		return Object.keys(unsupported);
	return [];
}

export async function buildEsmSmokeMatrix({ pieElementsNgRoot }) {
	const reportPath = path.join(
		pieElementsNgRoot,
		".compatibility",
		"report.json",
	);
	const report = await readJson(reportPath);
	const blocked = blockedEntries(report);
	if (blocked.length > 0) {
		throw new Error(
			`Cannot build ESM smoke matrix while browserEsmUnsupported is non-empty: ${blocked.join(", ")}`,
		);
	}

	const ready = [...(report.browserEsmReady ?? [])].sort();
	const covered = new Set([...ready, ...blocked]);
	const publishable = await listPublishableElementSlugs(pieElementsNgRoot);
	const missingFromReport = publishable.filter((slug) => !covered.has(slug));
	if (missingFromReport.length > 0) {
		throw new Error(
			`Compatibility report is missing publishable element packages: ${missingFromReport.join(", ")}`,
		);
	}

	const matrix = [];
	for (const slug of ready) {
		const packageDir = findElementPackageDir(pieElementsNgRoot, slug);
		if (!packageDir) {
			throw new Error(`Browser-ready element package not found: ${slug}`);
		}
		const pkg = await readJson(path.join(packageDir, "package.json"));
		const sample = await loadSampleForSlug(pieElementsNgRoot, slug);
		const browserViews = collectBrowserViews(pkg);
		matrix.push({
			slug,
			packageName: pkg.name,
			packageDir,
			kind: inferElementKind(packageDir),
			browserViews,
			sharedDependencies: pkg.pie?.browserSharedDependencies ?? {},
			fixtureId: sample.fixtureId,
			elementTag: sample.elementTag,
			model: sample.model,
			session: sample.session,
			markup: sample.markup,
			registrationOnly: sample.registrationOnly,
			samplePath: sample.samplePath,
		});
	}
	return matrix;
}

export function parseJsDelivrPieUrl(input) {
	const url = new URL(input);
	const pathname = url.pathname.replace(/^\/npm/, "");
	const parts = pathname.split("/").filter(Boolean);
	if (parts.length < 2) return null;
	const scope = parts[0];
	if (!["@pie-element", "@pie-lib", "@pie-elements-ng"].includes(scope)) {
		return null;
	}
	const nameWithVersion = parts[1];
	const at = nameWithVersion.lastIndexOf("@");
	const name = at > 0 ? nameWithVersion.slice(0, at) : nameWithVersion;
	return {
		packageName: `${scope}/${name}`,
		subpath: parts.slice(2).join("/"),
		localPath: `/${parts.join("/")}`,
	};
}

export function createJsDelivrLocalMapper() {
	return {
		parse: parseJsDelivrPieUrl,
		toLocalCdnPath(input) {
			const parsed = parseJsDelivrPieUrl(input);
			if (!parsed) return null;
			const parts = parsed.localPath.split("/").filter(Boolean);
			if (parsed.subpath === "package.json") {
				return parsed.localPath;
			}
			if (parts[2] === "dist") {
				return `/${parts[0]}/${parts[1]}/${parts.slice(3).join("/")}`;
			}
			if (
				/^browser\/(delivery|author|print|controller)\/.+\.js$/.test(
					parsed.subpath,
				) &&
				!parsed.subpath.endsWith("/index.js")
			) {
				return `/${parts[0]}/${parts[1]}/browser/${path.basename(parsed.subpath)}`;
			}
			return parsed.localPath;
		},
	};
}

export async function listSampleSlugs(pieElementsNgRoot) {
	const sampleDir = path.join(
		pieElementsNgRoot,
		"apps",
		"element-demo",
		"src",
		"lib",
		"samples",
	);
	const entries = await readdir(sampleDir).catch(() => []);
	return entries
		.filter((entry) => entry.endsWith(".json"))
		.map((entry) => entry.slice(0, -".json".length))
		.sort();
}
