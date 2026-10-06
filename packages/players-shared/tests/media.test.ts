import { describe, expect, test } from "bun:test";
import { applyMediaFragment } from "../src/media/index.js";

describe("media fragments", () => {
	test("appends a fragment range as a Media Fragments URI", () => {
		expect(
			applyMediaFragment("https://cdn.example.com/asl.mp4", {
				startSeconds: 3,
				endSeconds: 8,
			}),
		).toBe("https://cdn.example.com/asl.mp4#t=3,8");
		expect(
			applyMediaFragment("https://cdn.example.com/asl.mp4", {
				startSeconds: 3,
			}),
		).toBe("https://cdn.example.com/asl.mp4#t=3");
	});

	test("leaves an authored fragment alone", () => {
		expect(
			applyMediaFragment("https://cdn.example.com/asl.mp4#t=1,2", {
				startSeconds: 9,
			}),
		).toBe("https://cdn.example.com/asl.mp4#t=1,2");
	});

	test("is a no-op without a fragment", () => {
		expect(applyMediaFragment("https://cdn.example.com/asl.mp4")).toBe(
			"https://cdn.example.com/asl.mp4",
		);
	});
});
