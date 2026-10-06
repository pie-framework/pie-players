import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

await import("../dist/tool-tts-inline.js");

const settle = async () => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

const mountRecordingActiveChanges = async (
	prepare?: (element: HTMLElement) => void,
) => {
	const element = document.createElement("pie-tool-tts-inline");
	prepare?.(element);
	const announced: Array<boolean | undefined> = [];
	element.addEventListener("pie-tool-active-change", (event) => {
		announced.push((event as CustomEvent<{ active?: boolean }>).detail?.active);
	});
	document.body.append(element);
	await settle();
	return { element, announced };
};

afterEach(() => {
	document.body.replaceChildren();
});

afterAll(async () => {
	document.body.replaceChildren();
	await settle();
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

test("mounting inactive announces nothing", async () => {
	const { element, announced } = await mountRecordingActiveChanges();

	expect(
		element.shadowRoot?.querySelector(".pie-tool-tts-inline"),
	).not.toBeNull();
	expect(announced).toEqual([]);
	expect(element.hasAttribute("data-active")).toBe(false);
});

test("a remount announces the reset of a host last announced active", async () => {
	const { element, announced } = await mountRecordingActiveChanges((host) =>
		host.setAttribute("data-active", "true"),
	);

	expect(announced).toEqual([false]);
	expect(element.getAttribute("data-active")).toBe("false");
});
