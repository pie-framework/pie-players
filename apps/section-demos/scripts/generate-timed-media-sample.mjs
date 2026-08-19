#!/usr/bin/env bun
/**
 * Generate the timed-media demo's slide-deck stimulus.
 *
 * The demo needs a video whose visible content changes exactly on the cue
 * timestamps, so that watching it is enough to see why a question appeared. This
 * renders that video from a canvas and records it with `MediaRecorder`, which
 * means the asset is reproducible from source rather than an opaque binary: the
 * slide copy, the timings and the palette all live here, and regenerating after a
 * cue change is one command.
 *
 *   bun run apps/section-demos/scripts/generate-timed-media-sample.mjs
 *
 * Recording is real-time (MediaRecorder timestamps frames as they arrive), so the
 * run takes about as long as the clip.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../static/demo-assets/timed-media/water-cycle-lesson.webm");

/** Kept in step with `demo-timed-media.ts`: each cue lands inside a slide. */
const DURATION_SECONDS = 20;
const WIDTH = 854;
const HEIGHT = 480;

async function main() {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<!doctype html><title>recorder</title><body></body>");

	const base64 = await page.evaluate(
		async ({ durationSeconds, width, height }) => {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext("2d");

			const BG = "#f7f9fc";
			const INK = "#0f172a";
			const MUTED = "#4b5563";
			const ACCENT = "#146eb3";

			function roundRect(x, y, w, h, r) {
				ctx.beginPath();
				ctx.moveTo(x + r, y);
				ctx.arcTo(x + w, y, x + w, y + h, r);
				ctx.arcTo(x + w, y + h, x, y + h, r);
				ctx.arcTo(x, y + h, x, y, r);
				ctx.arcTo(x, y, x + w, y, r);
				ctx.closePath();
			}

			function chrome(t, chapter) {
				ctx.fillStyle = BG;
				ctx.fillRect(0, 0, width, height);
				ctx.fillStyle = ACCENT;
				ctx.fillRect(0, 0, width, 8);
				ctx.fillStyle = MUTED;
				ctx.font = "500 18px system-ui, sans-serif";
				ctx.textAlign = "left";
				ctx.fillText("PIE 101 · The Water Cycle", 48, 56);
				ctx.textAlign = "right";
				ctx.fillText(chapter, width - 48, 56);
				const pct = Math.min(1, t / durationSeconds);
				ctx.fillStyle = "#dde3ec";
				roundRect(48, height - 56, width - 96, 6, 3);
				ctx.fill();
				ctx.fillStyle = ACCENT;
				roundRect(48, height - 56, (width - 96) * pct, 6, 3);
				ctx.fill();
				const ss = String(Math.floor(t % 60)).padStart(2, "0");
				ctx.fillStyle = MUTED;
				ctx.font = "400 15px ui-monospace, monospace";
				ctx.textAlign = "left";
				ctx.fillText(`0:${ss} / 0:${durationSeconds}`, 48, height - 24);
			}

			function wrap(text, x, y, maxWidth, lineHeight) {
				const words = text.split(" ");
				let line = "";
				for (const word of words) {
					const next = line ? `${line} ${word}` : word;
					if (ctx.measureText(next).width > maxWidth && line) {
						ctx.fillText(line, x, y);
						line = word;
						y += lineHeight;
					} else {
						line = next;
					}
				}
				if (line) ctx.fillText(line, x, y);
			}

			function slide(t) {
				ctx.textAlign = "left";
				if (t < 3) {
					chrome(t, "Module 2");
					ctx.fillStyle = INK;
					ctx.font = "700 54px system-ui, sans-serif";
					ctx.fillText("The Water Cycle", 48, 210);
					ctx.fillStyle = MUTED;
					ctx.font = "400 28px system-ui, sans-serif";
					ctx.fillText("Module 2 — how water moves through the air", 48, 262);
					return;
				}
				if (t < 8) {
					chrome(t, "Step 1 of 3");
					ctx.fillStyle = ACCENT;
					ctx.font = "600 22px system-ui, sans-serif";
					ctx.fillText("STEP 1", 48, 140);
					ctx.fillStyle = INK;
					ctx.font = "700 48px system-ui, sans-serif";
					ctx.fillText("Evaporation", 48, 200);
					ctx.fillStyle = MUTED;
					ctx.font = "400 27px system-ui, sans-serif";
					wrap(
						"The sun heats water in oceans and lakes. Liquid water turns into water vapour and rises into the air.",
						48,
						260,
						width - 96,
						40,
					);
					return;
				}
				if (t < 16) {
					chrome(t, "Step 2 of 3");
					ctx.fillStyle = ACCENT;
					ctx.font = "600 22px system-ui, sans-serif";
					ctx.fillText("STEP 2", 48, 140);
					ctx.fillStyle = INK;
					ctx.font = "700 48px system-ui, sans-serif";
					ctx.fillText("Condensation", 48, 200);
					ctx.fillStyle = MUTED;
					ctx.font = "400 27px system-ui, sans-serif";
					wrap(
						"Higher up the air is colder. Water vapour cools, condenses onto tiny particles, and forms clouds.",
						48,
						260,
						width - 96,
						40,
					);
					return;
				}
				chrome(t, "Summary");
				ctx.fillStyle = INK;
				ctx.font = "700 44px system-ui, sans-serif";
				ctx.fillText("Summary", 48, 170);
				ctx.fillStyle = MUTED;
				ctx.font = "400 30px system-ui, sans-serif";
				ctx.fillText("evaporation → condensation → precipitation", 48, 240);
			}

			const stream = canvas.captureStream(12);
			const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
				? "video/webm;codecs=vp9"
				: "video/webm;codecs=vp8";
			const recorder = new MediaRecorder(stream, {
				mimeType,
				videoBitsPerSecond: 600_000,
			});
			const chunks = [];
			recorder.ondataavailable = (event) => {
				if (event.data.size) chunks.push(event.data);
			};
			const stopped = new Promise((resolveStopped) => {
				recorder.onstop = resolveStopped;
			});

			const startedAt = performance.now();
			recorder.start(500);
			await new Promise((resolveDraw) => {
				function frame() {
					const elapsed = (performance.now() - startedAt) / 1000;
					slide(Math.min(elapsed, durationSeconds));
					if (elapsed < durationSeconds) {
						requestAnimationFrame(frame);
						return;
					}
					recorder.stop();
					resolveDraw();
				}
				frame();
			});
			await stopped;

			const blob = new Blob(chunks, { type: "video/webm" });
			const bytes = new Uint8Array(await blob.arrayBuffer());
			let binary = "";
			for (let index = 0; index < bytes.length; index += 1) {
				binary += String.fromCharCode(bytes[index]);
			}
			return btoa(binary);
		},
		{ durationSeconds: DURATION_SECONDS, width: WIDTH, height: HEIGHT },
	);

	await browser.close();
	await mkdir(dirname(OUT), { recursive: true });
	const buffer = Buffer.from(base64, "base64");
	await writeFile(OUT, buffer);
	console.log(
		`[timed-media] wrote ${OUT} (${(buffer.byteLength / 1024).toFixed(1)} KB, ${DURATION_SECONDS}s, ${WIDTH}x${HEIGHT})`,
	);
}

await main();
