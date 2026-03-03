import { expect, test } from "@playwright/test";

function makePngBuffer(): Buffer {
	// 1x1 transparent PNG
	return Buffer.from(
		"89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000000020001e221bc330000000049454e44ae426082",
		"hex",
	);
}

function makeWavBuffer(): Buffer {
	// Minimal valid-ish WAV header for demo upload plumbing tests.
	return Buffer.from(
		"524946462400000057415645666d74201000000001000100401f0000803e0000020010006461746100000000",
		"hex",
	);
}

test.describe("item-demos authoring media endpoints", () => {
	test("insert image stores file, serves it, and delete removes it", async ({ request }) => {
		const insertResponse = await request.post("/api/authoring-media/insert-image", {
			multipart: {
				file: {
					name: "demo-image.png",
					mimeType: "image/png",
					buffer: makePngBuffer(),
				},
				isPasted: "false",
			},
		});
		expect(insertResponse.ok()).toBe(true);
		const insertPayload = (await insertResponse.json()) as { ok: boolean; src: string };
		expect(insertPayload.ok).toBe(true);
		expect(insertPayload.src).toMatch(/^\/api\/authoring-media\/file\/.+/);

		const fetchStoredResponse = await request.get(insertPayload.src);
		expect(fetchStoredResponse.ok()).toBe(true);
		expect(fetchStoredResponse.headers()["content-type"]).toContain("image/png");

		const deleteResponse = await request.post("/api/authoring-media/delete-image", {
			data: { src: insertPayload.src },
		});
		expect(deleteResponse.ok()).toBe(true);

		const fetchAfterDeleteResponse = await request.get(insertPayload.src);
		expect(fetchAfterDeleteResponse.status()).toBe(404);
	});

	test("insert sound stores file, serves it, and delete removes it", async ({ request }) => {
		const insertResponse = await request.post("/api/authoring-media/insert-sound", {
			multipart: {
				file: {
					name: "demo-sound.wav",
					mimeType: "audio/wav",
					buffer: makeWavBuffer(),
				},
			},
		});
		expect(insertResponse.ok()).toBe(true);
		const insertPayload = (await insertResponse.json()) as { ok: boolean; src: string };
		expect(insertPayload.ok).toBe(true);
		expect(insertPayload.src).toMatch(/^\/api\/authoring-media\/file\/.+/);

		const fetchStoredResponse = await request.get(insertPayload.src);
		expect(fetchStoredResponse.ok()).toBe(true);
		expect(fetchStoredResponse.headers()["content-type"]).toContain("audio/wav");

		const deleteResponse = await request.post("/api/authoring-media/delete-sound", {
			data: { src: insertPayload.src },
		});
		expect(deleteResponse.ok()).toBe(true);

		const fetchAfterDeleteResponse = await request.get(insertPayload.src);
		expect(fetchAfterDeleteResponse.status()).toBe(404);
	});
});
