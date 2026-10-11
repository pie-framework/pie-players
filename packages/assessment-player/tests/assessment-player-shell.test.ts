/**
 * `<pie-assessment-player-shell>` renders its scaffold in a shadow root, so the
 * host's children stay in light DOM and project into the navigation and body
 * slots.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, describe, expect, test } from "bun:test";

// bun runs every test file in one process, and custom element definitions
// cannot be removed, so the DOM stays registered for the process.
if (typeof window === "undefined") GlobalRegistrator.register();

await import("../src/components/assessment-player-shell-element.js");

afterEach(() => {
	document.body.replaceChildren();
});

function mountShell(attributes: Record<string, string> = {}) {
	const shell = document.createElement("pie-assessment-player-shell");
	for (const [name, value] of Object.entries(attributes)) {
		shell.setAttribute(name, value);
	}
	const navigation = document.createElement("nav");
	navigation.slot = "navigation";
	const section = document.createElement("div");
	section.className = "host-section";
	shell.append(navigation, section);
	document.body.appendChild(shell);
	return { shell, navigation, section };
}

function slot(shell: Element, name?: string) {
	const selector = name ? `slot[name="${name}"]` : "slot:not([name])";
	return shell.shadowRoot?.querySelector<HTMLSlotElement>(selector) ?? null;
}

describe("pie-assessment-player-shell", () => {
	test("projects host children into the navigation and body slots", () => {
		const { shell, navigation, section } = mountShell();

		expect([...shell.children]).toEqual([navigation, section]);
		expect(slot(shell, "navigation")?.assignedElements()).toEqual([
			navigation,
		]);
		expect(slot(shell)?.assignedElements()).toEqual([section]);
		expect(
			slot(shell)?.closest(".pie-assessment-player-shell__body"),
		).not.toBeNull();
	});

	test("keeps host children across show-navigation changes", () => {
		const { shell, navigation, section } = mountShell({
			"show-navigation": "false",
		});

		expect(slot(shell, "navigation")).toBeNull();
		expect(slot(shell)?.assignedElements()).toEqual([section]);

		shell.setAttribute("show-navigation", "true");

		expect([...shell.children]).toEqual([navigation, section]);
		expect(slot(shell, "navigation")?.assignedElements()).toEqual([
			navigation,
		]);
		expect(slot(shell)?.assignedElements()).toEqual([section]);
	});

	test("styles its host from the shadow root", () => {
		const { shell } = mountShell();

		expect(getComputedStyle(shell).display).toBe("block");
	});
});
