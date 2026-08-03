import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";

import {
	contentStylesOptedOut,
	contentStylesPresent,
	installContentStyles,
	resetContentStylesWarningForTesting,
	auditContentStyles,
} from "../src/ui/content-styles.js";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const CSS =
	":root { --pie-content-styles: 1; }\n.numbered-paragraph { margin-left: 36px; }";

afterEach(() => {
	document.head.innerHTML = "";
	document.documentElement.removeAttribute("data-pie-content-styles");
	resetContentStylesWarningForTesting();
});

const installedStyles = () =>
	Array.from(document.querySelectorAll("style[data-pie-content-styles]"));

describe("installContentStyles", () => {
	test("installs the stylesheet and records the installing package", () => {
		expect(installContentStyles(CSS, "pie-item-player")).toBe("installed");

		const styles = installedStyles();
		expect(styles).toHaveLength(1);
		expect(styles[0]?.getAttribute("data-pie-content-styles")).toBe(
			"pie-item-player",
		);
		expect(styles[0]?.textContent).toContain(".numbered-paragraph");
	});

	test("is idempotent across repeated calls and multiple player packages", () => {
		expect(installContentStyles(CSS, "pie-item-player")).toBe("installed");
		expect(installContentStyles(CSS, "pie-item-player")).toBe(
			"already-installed",
		);
		expect(installContentStyles(CSS, "pie-print-player")).toBe(
			"already-installed",
		);

		expect(installedStyles()).toHaveLength(1);
	});

	test("prepends so later host stylesheets win ties at equal specificity", () => {
		const hostStyle = document.createElement("style");
		hostStyle.id = "host";
		document.head.append(hostStyle);

		installContentStyles(CSS, "pie-item-player");

		// The host's stylesheet must still come last in document order — this is
		// the placement hosts were previously told to set up by hand.
		expect(
			document.head.firstElementChild?.getAttribute("data-pie-content-styles"),
		).toBe("pie-item-player");
		expect(document.head.lastElementChild?.id).toBe("host");
	});

	test("does not install when the host opts out", () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");

		expect(contentStylesOptedOut()).toBe(true);
		expect(installContentStyles(CSS, "pie-item-player")).toBe("opted-out");
		expect(installedStyles()).toHaveLength(0);
	});

	test("treats any other attribute value as not opted out", () => {
		document.documentElement.setAttribute("data-pie-content-styles", "player");

		expect(contentStylesOptedOut()).toBe(false);
		expect(installContentStyles(CSS, "pie-item-player")).toBe("installed");
	});
});

describe("contentStylesPresent", () => {
	test("is false with no stylesheet and true once one is applied", () => {
		expect(contentStylesPresent()).toBe(false);

		installContentStyles(CSS, "pie-item-player");

		expect(contentStylesPresent()).toBe(true);
	});

	test("detects a stylesheet the host loaded itself, not just our injection", () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = CSS;
		document.head.append(hostStyle);

		// No marker attribute anywhere — detection reads the sentinel property the
		// stylesheet itself declares, so the delivery route does not matter.
		expect(installedStyles()).toHaveLength(0);
		expect(contentStylesPresent()).toBe(true);
	});
});

describe("auditContentStyles", () => {
	const captureWarnings = async (): Promise<string[]> => {
		const warnings: string[] = [];
		const original = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map(String).join(" "));
		};
		try {
			auditContentStyles("pie-item-player");
			// The check is deferred two animation frames to let an async host
			// stylesheet land before it is judged missing.
			await new Promise((resolve) => setTimeout(resolve, 50));
		} finally {
			console.warn = original;
		}
		return warnings;
	};

	test("stays silent when the player installed the only copy", async () => {
		installContentStyles(CSS, "pie-item-player");

		expect(await captureWarnings()).toEqual([]);
	});

	test("stays silent when nothing is loaded and the host did not opt out", async () => {
		// Not a state the players produce — installation precedes the audit — but
		// the audit must not invent a complaint about a stylesheet nobody asked for.
		expect(await captureWarnings()).toEqual([]);
	});

	test("warns when the host opted out but shipped no stylesheet", async () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");

		const warnings = await captureWarnings();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("No PIE content stylesheet found");
		expect(warnings[0]).toContain("@pie-players/pie-theme/components.css");
	});

	test("stays silent when an opted-out host did load the stylesheet", async () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = CSS;
		document.head.append(hostStyle);

		expect(await captureWarnings()).toEqual([]);
	});

	test("warns when a host copy sits alongside the installed copy", async () => {
		// The upgrade path that matters: a host that keeps its manual import after
		// moving to a player version that installs the stylesheet itself.
		installContentStyles(CSS, "pie-item-player");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = CSS;
		document.head.append(hostStyle);

		const warnings = await captureWarnings();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("loaded twice");
		expect(warnings[0]).toContain("Remove the host import");
	});

	test("does not count the installed copy as a duplicate of itself", async () => {
		installContentStyles(CSS, "pie-item-player");
		installContentStyles(CSS, "pie-item-player");

		expect(await captureWarnings()).toEqual([]);
	});

	test("treats an opted-out host's own copy as correct, not duplicated", async () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = CSS;
		document.head.append(hostStyle);

		expect(installContentStyles(CSS, "pie-item-player")).toBe("opted-out");
		expect(await captureWarnings()).toEqual([]);
	});

	test("warns only once per page", async () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");

		expect(await captureWarnings()).toHaveLength(1);
		expect(await captureWarnings()).toHaveLength(0);
	});
});
