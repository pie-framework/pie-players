import { afterEach, describe, expect, it } from "bun:test";
import { handleRequest } from "../src/core/handler.ts";
import {
	createFixtureContext,
	createTempFixture,
	makeRequest,
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

describe("local-esm-cdn help and CORS", () => {
	it("serves help text from root and __help", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);

		const context = createFixtureContext(fixture, {
			esmShBaseUrl: "https://esm.sh",
		});

		for (const route of ["/", "/__help"]) {
			const response = await handleRequest(makeRequest(route), context);
			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain("text/plain");
			const body = await response.text();
			expect(body).toContain("PIE local ESM CDN");
			expect(body).toContain("GET  /health");
			expect(body).toContain(`PIE_ELEMENTS_NG_PATH=${fixture.pieElementsNgRoot}`);
			expect(body).toContain("LOCAL_ESM_CDN_ESM_SH_BASE_URL=https://esm.sh");
		}
	});

	it("returns CORS preflight response for OPTIONS", async () => {
		const fixture = await createTempFixture();
		cleanups.push(fixture.cleanup);

		const context = createFixtureContext(fixture);
		const response = await handleRequest(
			makeRequest("/@pie-element/hotspot@1.0.0", { method: "OPTIONS" }),
			context,
		);

		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
		expect(response.headers.get("access-control-allow-methods")).toContain(
			"OPTIONS",
		);
		expect(response.headers.get("access-control-allow-headers")).toBe("*");
	});
});
