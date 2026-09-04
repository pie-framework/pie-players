import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";

const PACKAGE_SPEC = "@pie-element/video-stimulus@0.1.0";
const VERSIONED_ELEMENT = "video-stimulus--version-0-1-0";
const PLAYERS_ROOT = resolve(import.meta.dirname, "../../..");
const ELEMENTS_ROOT = resolve(PLAYERS_ROOT, "../pie-elements-ng");
const SOURCE_PACKAGE_DIR = resolve(
	ELEMENTS_ROOT,
	"packages/elements-svelte/video-stimulus",
);
const SOURCE_FIXTURE_DIR = resolve(
	ELEMENTS_ROOT,
	"apps/element-demo/static/video-stimulus",
);
const SOURCE_SAMPLE_PATH = resolve(
	ELEMENTS_ROOT,
	"apps/element-demo/src/lib/samples/video-stimulus.json",
);
const DEMO_PATH =
	"/timed-media?page=video-stimulus-package&mode=candidate&layout=splitpane&player=esm";

let tempRoot: string | null = null;
let extractedPackageRoot: string | null = null;

type PackageManifest = {
	name?: string;
	version?: string;
	dependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
};

type TimedMediaProjection = {
	mediaAttached?: boolean;
	revealedItemIds?: string[];
} | null;

function firstPackResult(value: unknown): { filename: string } {
	const candidate = Array.isArray(value)
		? value[0]
		: value && typeof value === "object"
			? Object.values(value as Record<string, unknown>)[0]
			: null;
	if (
		!candidate ||
		typeof candidate !== "object" ||
		typeof (candidate as { filename?: unknown }).filename !== "string"
	) {
		throw new Error("npm pack did not return a tarball filename");
	}
	return candidate as { filename: string };
}

function contentType(filePath: string): string {
	switch (extname(filePath)) {
		case ".js":
			return "application/javascript";
		case ".json":
		case ".map":
			return "application/json";
		case ".svg":
			return "image/svg+xml";
		case ".vtt":
			return "text/vtt";
		case ".webm":
			return "video/webm";
		default:
			return "application/octet-stream";
	}
}

async function routePackedPackage(
	page: Page,
	servedPaths: Set<string>,
): Promise<void> {
	if (!extractedPackageRoot) throw new Error("Packed package is not ready");
	const packageRoot = extractedPackageRoot;
	const packageUrlPrefix = "https://cdn.jsdelivr.net/npm/" + PACKAGE_SPEC + "/";
	await page.route(packageUrlPrefix + "**", async (route) => {
		const requestUrl = route.request().url();
		const relativePath = decodeURIComponent(
			requestUrl.slice(packageUrlPrefix.length).split("?", 1)[0],
		);
		const filePath = resolve(packageRoot, relativePath);
		if (filePath !== packageRoot && !filePath.startsWith(packageRoot + sep)) {
			await route.fulfill({ status: 403, body: "Forbidden package path" });
			return;
		}
		if (!existsSync(filePath)) {
			await route.fulfill({ status: 404, body: "Missing packed file" });
			return;
		}
		servedPaths.add(relativePath);
		await route.fulfill({
			status: 200,
			contentType: contentType(filePath),
			body: readFileSync(filePath),
		});
	});
}

async function routeSourceFixtures(page: Page): Promise<void> {
	const fixtureFiles = new Map<string, string>([
		["/video-stimulus/sample.webm", "sample.webm"],
		["/video-stimulus/captions-en.vtt", "captions-en.vtt"],
		["/video-stimulus/poster.svg", "poster.svg"],
	]);
	await page.route("**/video-stimulus/**", async (route) => {
		const pathname = new URL(route.request().url()).pathname;
		const fixtureName = fixtureFiles.get(pathname);
		if (!fixtureName) {
			await route.fallback();
			return;
		}
		const fixturePath = resolve(SOURCE_FIXTURE_DIR, fixtureName);
		await route.fulfill({
			status: 200,
			contentType: contentType(fixturePath),
			body: readFileSync(fixturePath),
		});
	});
}

async function projection(page: Page): Promise<TimedMediaProjection> {
	return page.evaluate(() => {
		const pane = document.querySelector(
			"pie-section-player-items-pane",
		) as unknown as {
			compositionModel?: { timedMedia?: TimedMediaProjection };
		};
		return pane?.compositionModel?.timedMedia ?? null;
	});
}

function itemCard(page: Page, itemId: string) {
	return page
		.locator(
			'[data-section-item-card][data-canonical-item-id="' + itemId + '"]',
		)
		.first();
}

function sourceTranscript(): string {
	const sample = JSON.parse(readFileSync(SOURCE_SAMPLE_PATH, "utf8")) as {
		demos?: Array<{
			model?: { media?: { transcript?: { plainText?: string } } };
		}>;
	};
	const transcript = sample.demos?.[0]?.model?.media?.transcript?.plainText;
	if (!transcript)
		throw new Error("Source video-stimulus transcript is missing");
	return transcript;
}

test.describe("package-backed video stimulus timed media", () => {
	test.skip(
		!existsSync(SOURCE_PACKAGE_DIR) || !existsSync(SOURCE_FIXTURE_DIR),
		"requires the sibling pie-elements-ng checkout and its original video fixtures",
	);

	test.beforeAll(() => {
		test.setTimeout(120_000);
		execFileSync("bun", ["run", "build"], {
			cwd: SOURCE_PACKAGE_DIR,
			stdio: "inherit",
		});
		tempRoot = mkdtempSync(join(tmpdir(), "pie-video-stimulus-pack-"));
		const packOutput = execFileSync(
			"npm",
			["pack", "--json", "--pack-destination", tempRoot],
			{ cwd: SOURCE_PACKAGE_DIR, encoding: "utf8" },
		);
		const packResult = firstPackResult(JSON.parse(packOutput));
		const extractedRoot = resolve(tempRoot, "extracted");
		mkdirSync(extractedRoot, { recursive: true });
		execFileSync(
			"tar",
			["-xzf", resolve(tempRoot, packResult.filename), "-C", extractedRoot],
			{ stdio: "inherit" },
		);
		extractedPackageRoot = resolve(extractedRoot, "package");
		const manifest = JSON.parse(
			readFileSync(resolve(extractedPackageRoot, "package.json"), "utf8"),
		) as PackageManifest;
		expect(manifest.name).toBe("@pie-element/video-stimulus");
		expect(manifest.version).toBe("0.1.0");
		const dependencyValues = [
			...Object.values(manifest.dependencies ?? {}),
			...Object.values(manifest.optionalDependencies ?? {}),
			...Object.values(manifest.peerDependencies ?? {}),
		];
		expect(
			dependencyValues.filter((value) => /^(file|link):/i.test(value)),
		).toEqual([]);
		expect(
			existsSync(
				resolve(extractedPackageRoot, "dist/browser/delivery/index.js"),
			),
		).toBe(true);
	});

	test.afterAll(() => {
		if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
	});

	test("loads the packed element and reveals two questions on separate real playback cues", async ({
		page,
	}) => {
		test.setTimeout(90_000);
		const servedPackagePaths = new Set<string>();
		await routePackedPackage(page, servedPackagePaths);
		await routeSourceFixtures(page);
		await page.goto(DEMO_PATH);

		const packagedElement = page.locator(VERSIONED_ELEMENT).first();
		await expect(packagedElement).toBeAttached({ timeout: 30_000 });
		await page.waitForFunction(
			(tagName) => customElements.get(tagName) !== undefined,
			VERSIONED_ELEMENT,
			{ timeout: 30_000 },
		);
		const lightDom = await packagedElement.evaluate((host) => ({
			hasShadowRoot: host.shadowRoot !== null,
			videoCount: host.querySelectorAll("video").length,
		}));
		expect(lightDom).toEqual({ hasShadowRoot: false, videoCount: 1 });

		const nativeVideo = packagedElement.locator("video");
		await expect(nativeVideo).toBeVisible();
		await expect(nativeVideo.locator("source")).toHaveAttribute(
			"src",
			"/video-stimulus/sample.webm",
		);
		await expect(nativeVideo.locator('track[kind="captions"]')).toHaveAttribute(
			"src",
			"/video-stimulus/captions-en.vtt",
		);
		await packagedElement
			.getByRole("button", { name: "Show transcript" })
			.click();
		await expect(
			packagedElement.getByText(sourceTranscript(), { exact: true }),
		).toBeVisible();

		expect(servedPackagePaths).toContain("package.json");
		expect(servedPackagePaths).toContain("dist/browser/delivery/index.js");
		expect(servedPackagePaths).toContain("dist/browser/controller/index.js");

		await expect
			.poll(async () => (await projection(page))?.mediaAttached, {
				timeout: 15_000,
			})
			.toBe(true);
		const questionOne = itemCard(page, "video-stimulus-q1");
		const questionTwo = itemCard(page, "video-stimulus-q2");
		await expect(questionOne).toBeAttached();
		await expect(questionTwo).toBeAttached();
		await expect(questionOne).toBeHidden();
		await expect(questionTwo).toBeHidden();
		expect((await projection(page))?.revealedItemIds).toEqual([]);

		await page.waitForFunction(
			(tagName) => {
				const media = document.querySelector(
					tagName + " video",
				) as HTMLVideoElement | null;
				return (media?.readyState ?? 0) >= 2;
			},
			VERSIONED_ELEMENT,
			{ timeout: 30_000 },
		);
		await nativeVideo.evaluate(async (media: HTMLVideoElement) => {
			media.muted = true;
			await media.play();
		});

		await expect(questionOne).toBeVisible({ timeout: 20_000 });
		await expect(questionTwo).toBeHidden();
		expect(
			await nativeVideo.evaluate(
				(media: HTMLVideoElement) => media.currentTime,
			),
		).toBeGreaterThan(1);

		await expect(questionTwo).toBeVisible({ timeout: 20_000 });
		expect(
			await nativeVideo.evaluate(
				(media: HTMLVideoElement) => media.currentTime,
			),
		).toBeGreaterThan(5);
		await expect
			.poll(async () => (await projection(page))?.revealedItemIds)
			.toEqual(["video-stimulus-q1", "video-stimulus-q2"]);
		expect((await projection(page))?.mediaAttached).toBe(true);
	});
});
