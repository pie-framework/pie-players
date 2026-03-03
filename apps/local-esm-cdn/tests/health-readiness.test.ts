import { afterEach, describe, expect, it } from "bun:test";
import { handleRequest } from "../src/core/handler.ts";
import {
	createFixtureContext,
	createTempFixture,
	makeRequest,
	readJson,
	writePackageFile,
} from "./fixtures.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
	while (cleanups.length) {
		const cleanup = cleanups.pop();
		if (cleanup) {
			await cleanup();
		}
	}
});

type HealthPayload = {
	ok: boolean;
	builtElementPackages: number;
	builtLibPackages: number;
};

describe("local-esm-cdn health and readiness", () => {
	it("reports unhealthy and healthy states and gates package requests", async () => {
		const unhealthy = await createTempFixture();
		cleanups.push(unhealthy.cleanup);
		const unhealthyContext = createFixtureContext(unhealthy);

		const unhealthyHealth = await handleRequest(
			makeRequest("/health"),
			unhealthyContext,
		);
		expect(unhealthyHealth.status).toBe(503);
		const unhealthyBody = await readJson<HealthPayload>(unhealthyHealth);
		expect(unhealthyBody.ok).toBe(false);
		expect(unhealthyBody.builtElementPackages).toBe(0);

		const gated = await handleRequest(
			makeRequest("/@pie-element/hotspot@1.0.0"),
			unhealthyContext,
		);
		expect(gated.status).toBe(503);
		const gatedBody = await readJson<{ error: string; hint: string }>(gated);
		expect(gatedBody.error).toContain("not ready");
		expect(gatedBody.hint).toContain("Run `bun run build`");

		const healthy = await createTempFixture();
		cleanups.push(healthy.cleanup);
		await writePackageFile({
			pieElementsNgRoot: healthy.pieElementsNgRoot,
			scope: "@pie-element",
			name: "hotspot",
			relativePath: "index.js",
			content: "export const ok = true;",
		});
		const healthyContext = createFixtureContext(healthy);

		// getHealth() caches for ~1.5s process-wide; wait to avoid stale unhealthy value.
		await Bun.sleep(1600);

		const healthyHealth = await handleRequest(makeRequest("/health"), healthyContext);
		expect(healthyHealth.status).toBe(200);
		const healthyBody = await readJson<HealthPayload>(healthyHealth);
		expect(healthyBody.ok).toBe(true);
		expect(healthyBody.builtElementPackages).toBeGreaterThan(0);
	});
});
