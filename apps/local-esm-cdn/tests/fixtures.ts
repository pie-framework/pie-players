import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { LocalEsmCdnContext } from "../src/core/config.ts";
import { createContext, mergeConfig } from "../src/core/config.ts";

type TempFixture = {
	tmpRoot: string;
	pieElementsNgRoot: string;
	piePlayersRoot: string;
	cleanup: () => Promise<void>;
};

type PackageScope = "@pie-element" | "@pie-lib" | "@pie-elements-ng";

export async function createTempFixture(): Promise<TempFixture> {
	const tmpRoot = await mkdtemp(path.join(tmpdir(), "local-esm-cdn-test-"));
	const pieElementsNgRoot = path.join(tmpRoot, "pie-elements-ng");
	const piePlayersRoot = path.join(tmpRoot, "pie-players");

	await mkdir(pieElementsNgRoot, { recursive: true });
	await mkdir(piePlayersRoot, { recursive: true });

	return {
		tmpRoot,
		pieElementsNgRoot,
		piePlayersRoot,
		cleanup: async () => {
			await rm(tmpRoot, { recursive: true, force: true });
		},
	};
}

export function createFixtureContext(
	fixture: Pick<TempFixture, "pieElementsNgRoot" | "piePlayersRoot">,
	overrides: Partial<Parameters<typeof mergeConfig>[0]> = {},
): LocalEsmCdnContext {
	const config = mergeConfig({
		pieElementsNgRoot: fixture.pieElementsNgRoot,
		piePlayersRoot: fixture.piePlayersRoot,
		esmShBaseUrl: "https://esm.sh",
		...overrides,
	});
	return createContext(config);
}

function packageBaseDir(
	pieElementsNgRoot: string,
	scope: PackageScope,
	name: string,
): string {
	if (scope === "@pie-element") {
		return path.join(
			pieElementsNgRoot,
			"packages",
			"elements-react",
			name,
			"dist",
		);
	}
	if (scope === "@pie-lib") {
		return path.join(pieElementsNgRoot, "packages", "lib-react", name, "dist");
	}
	const sharedName = name.replace(/^shared-/, "");
	return path.join(pieElementsNgRoot, "packages", "shared", sharedName, "dist");
}

export async function writePackageFile(params: {
	pieElementsNgRoot: string;
	scope: PackageScope;
	name: string;
	relativePath: string;
	content: string;
}): Promise<string> {
	const dir = packageBaseDir(params.pieElementsNgRoot, params.scope, params.name);
	const target = path.join(dir, params.relativePath);
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, params.content, "utf8");
	return target;
}

export async function writePackageJson(params: {
	pieElementsNgRoot: string;
	scope: PackageScope;
	name: string;
	content: Record<string, unknown>;
}): Promise<string> {
	const dir = packageBaseDir(params.pieElementsNgRoot, params.scope, params.name);
	const packageRoot = path.dirname(dir);
	const target = path.join(packageRoot, "package.json");
	await mkdir(packageRoot, { recursive: true });
	await writeFile(target, JSON.stringify(params.content, null, 2), "utf8");
	return target;
}

export function makeRequest(
	pathname: string,
	init?: Omit<RequestInit, "method"> & { method?: string },
): Request {
	const method = init?.method ?? "GET";
	return new Request(`http://localhost${pathname}`, {
		...init,
		method,
	});
}

export async function readJson<T>(response: Response): Promise<T> {
	return (await response.json()) as T;
}
