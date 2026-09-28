import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const panelModule = `/@fs${repoRoot}/packages/tool-text-to-speech/dist/tool-text-to-speech.js`;

type FakeCall = { method: string; args: unknown[] };

declare global {
	interface Window {
		__ttsCalls: FakeCall[];
		__finishSpeech: () => void;
		__selectionListeners: { added: number; removed: number };
	}
}

// The panel speaks through the host's service: it must not initialize it, and
// its state follows the promise `speak` returns.
test("text-to-speech panel speaks the selection through the host's service", async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.__selectionListeners = { added: 0, removed: 0 };
		const add = Document.prototype.addEventListener;
		const remove = Document.prototype.removeEventListener;
		Document.prototype.addEventListener = function (
			this: Document,
			type: string,
			...rest: [EventListenerOrEventListenerObject, unknown?]
		) {
			if (type === "selectionchange") window.__selectionListeners.added++;
			return add.call(this, type, ...(rest as [EventListener]));
		};
		Document.prototype.removeEventListener = function (
			this: Document,
			type: string,
			...rest: [EventListenerOrEventListenerObject, unknown?]
		) {
			if (type === "selectionchange") window.__selectionListeners.removed++;
			return remove.call(this, type, ...(rest as [EventListener]));
		};
	});
	await page.goto("/", { waitUntil: "networkidle" });
	const listenersBefore = await page.evaluate(() => ({
		...window.__selectionListeners,
	}));

	await page.evaluate(async (moduleUrl) => {
		await import(/* @vite-ignore */ moduleUrl);
		window.__ttsCalls = [];
		const record =
			(method: string, result?: unknown) =>
			(...args: unknown[]) => {
				window.__ttsCalls.push({ method, args });
				return result;
			};
		const service = {
			initialize: record("initialize", Promise.resolve()),
			speak: (...args: unknown[]) => {
				window.__ttsCalls.push({ method: "speak", args });
				return new Promise<void>((done) => {
					window.__finishSpeech = done;
				});
			},
			stop: record("stop"),
			pause: record("pause"),
			resume: record("resume"),
			setPlaybackRate: record("setPlaybackRate", Promise.resolve()),
		};
		const passage = document.createElement("p");
		passage.id = "tts-panel-passage";
		passage.textContent = "The quick brown fox jumps over the lazy dog.";
		document.body.prepend(passage);
		const panel = document.createElement(
			"pie-tool-text-to-speech",
		) as HTMLElement & {
			ttsService: unknown;
		};
		panel.ttsService = service;
		panel.setAttribute("visible", "");
		document.body.appendChild(panel);
	}, panelModule);

	const panel = page.locator("pie-tool-text-to-speech");
	const play = panel.getByRole("button", { name: /play|speak/i }).first();
	await expect(play).toBeVisible();
	await expect(play).toBeDisabled();

	await page.evaluate(() => {
		const passage = document.getElementById("tts-panel-passage");
		const range = document.createRange();
		range.selectNodeContents(passage as Node);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	});
	await expect(play).toBeEnabled();
	await play.click();

	const speakCall = await page.evaluate(() => {
		const call = window.__ttsCalls.find((entry) => entry.method === "speak");
		if (!call) return null;
		const options = call.args[1] as { contentElement?: Element } | undefined;
		return {
			argCount: call.args.length,
			text: call.args[0],
			optionKeys: Object.keys(options ?? {}).sort(),
			contentElementId: options?.contentElement?.id ?? null,
		};
	});
	expect(speakCall).toEqual({
		argCount: 2,
		text: "The quick brown fox jumps over the lazy dog.",
		optionKeys: ["catalogId", "contentElement"],
		contentElementId: "tts-panel-passage",
	});
	await expect(play).toBeDisabled();

	await page.evaluate(() => window.__finishSpeech());
	await expect(play).toBeEnabled();

	await panel.locator('input[type="range"]').evaluate((input) => {
		const slider = input as HTMLInputElement;
		slider.value = "1.5";
		slider.dispatchEvent(new Event("input", { bubbles: true }));
		slider.dispatchEvent(new Event("change", { bubbles: true }));
	});
	await expect
		.poll(() =>
			page.evaluate(() =>
				window.__ttsCalls
					.filter((entry) => entry.method === "setPlaybackRate")
					.map((entry) => entry.args[0]),
			),
		)
		.toContain(1.5);

	await page.evaluate(() =>
		document.querySelector("pie-tool-text-to-speech")?.remove(),
	);
	const outcome = await page.evaluate(() => ({
		initializeCalls: window.__ttsCalls.filter(
			(entry) => entry.method === "initialize",
		).length,
		stopCalls: window.__ttsCalls.filter((entry) => entry.method === "stop")
			.length,
		listeners: window.__selectionListeners,
	}));
	expect(outcome.initializeCalls).toBe(0);
	expect(outcome.stopCalls).toBe(0);
	const added = outcome.listeners.added - listenersBefore.added;
	const removed = outcome.listeners.removed - listenersBefore.removed;
	expect(added).toBeGreaterThan(0);
	expect(removed).toBe(added);
});
