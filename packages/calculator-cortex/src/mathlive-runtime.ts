import type {
	MathfieldElement,
	VirtualKeyboardLayout,
} from "mathlive";
import type { CalculatorType } from "@pie-players/pie-calculator";
import type { CortexCalculatorLocalization } from "./localization.js";

const LEASE_KEY = Symbol.for("pie-players.calculator-cortex.mathlive-keyboard");

interface MathfieldConstructor {
	locale: string;
	decimalSeparator: "." | ",";
}

interface KeyboardLease {
	owner: symbol;
	baseLayouts: readonly (string | VirtualKeyboardLayout)[];
	baseEditToolbar: "none" | "default";
	baseLocale: string;
	baseDecimalSeparator: "." | ",";
}

type LeaseGlobal = typeof globalThis & {
	[LEASE_KEY]?: KeyboardLease;
};

const BASIC_LAYOUT: VirtualKeyboardLayout = {
	id: "pie-cortex-basic",
	label: "",
	displayEditToolbar: false,
	rows: [
		["7", "8", "9", "+", "-"],
		["4", "5", "6", "\\times", "\\div"],
		["1", "2", "3", "(", ")"],
		["0", ".", "\\sqrt{#0}", "\\%", "[backspace]"],
	],
};

const SCIENTIFIC_LAYOUT: VirtualKeyboardLayout = {
	id: "pie-cortex-scientific",
	label: "",
	displayEditToolbar: false,
	rows: [
		["\\sin(#0)", "\\cos(#0)", "\\tan(#0)", "\\ln(#0)", "\\log(#0)"],
		["\\sin^{-1}(#0)", "\\cos^{-1}(#0)", "\\tan^{-1}(#0)", "e^{#0}", "#@^{#0}"],
		["\\sqrt{#0}", "\\sqrt[#0]{#@}", "\\left|#0\\right|", "\\pi", "e"],
		["(", ")", "!", "[left]", "[right]"],
	],
};

const GRAPH_LAYOUT: VirtualKeyboardLayout = {
	...SCIENTIFIC_LAYOUT,
	id: "pie-cortex-graph",
	label: "",
	rows: [
		["x", "x^2", "x^3", "\\sqrt{x}", "\\left|x\\right|"],
		...(SCIENTIFIC_LAYOUT.rows ?? []),
	],
};

function layoutsFor(
	type: CalculatorType,
	localization: CortexCalculatorLocalization,
): VirtualKeyboardLayout[] {
	const basic = {
		...BASIC_LAYOUT,
		label: localization.t("virtualKeyboardBasic"),
	};
	const scientific = {
		...SCIENTIFIC_LAYOUT,
		label: localization.t("virtualKeyboardScientific"),
	};
	const graph = {
		...GRAPH_LAYOUT,
		label: localization.t("virtualKeyboardGraphing"),
	};
	if (type === "basic") return [basic];
	if (type === "graphing") return [basic, graph];
	return [basic, scientific];
}

function decimalSeparator(locale: string): "." | "," {
	try {
		const formatted = new Intl.NumberFormat(locale).format(1.1);
		return formatted.includes(",") ? "," : ".";
	} catch {
		return ".";
	}
}

export function acquireMathLiveKeyboard(
	owner: symbol,
	type: CalculatorType,
	localization: CortexCalculatorLocalization,
	mathfieldConstructor: MathfieldConstructor,
): () => void {
	if (typeof window === "undefined" || !window.mathVirtualKeyboard) return () => {};
	const leaseGlobal = globalThis as LeaseGlobal;
	const keyboard = window.mathVirtualKeyboard;
	const existing = leaseGlobal[LEASE_KEY];
	const lease: KeyboardLease = existing ?? {
		owner,
		baseLayouts: keyboard.layouts,
		baseEditToolbar: keyboard.editToolbar,
		baseLocale: mathfieldConstructor.locale,
		baseDecimalSeparator: mathfieldConstructor.decimalSeparator,
	};
	lease.owner = owner;
	leaseGlobal[LEASE_KEY] = lease;
	keyboard.layouts = layoutsFor(type, localization);
	keyboard.editToolbar = "none";
	mathfieldConstructor.locale = localization.locale;
	mathfieldConstructor.decimalSeparator = decimalSeparator(localization.locale);

	return () => {
		const current = leaseGlobal[LEASE_KEY];
		if (!current || current.owner !== owner) return;
		keyboard.layouts = current.baseLayouts;
		keyboard.editToolbar = current.baseEditToolbar;
		mathfieldConstructor.locale = current.baseLocale;
		mathfieldConstructor.decimalSeparator = current.baseDecimalSeparator;
		delete leaseGlobal[LEASE_KEY];
	};
}

export function configureMathfield(
	mathfield: MathfieldElement,
	label: string,
	restrictedMode: boolean,
): void {
	mathfield.setAttribute("aria-label", label);
	mathfield.mathVirtualKeyboardPolicy = "auto";
	mathfield.menuItems = [];
	mathfield.smartMode = false;
	mathfield.smartFence = true;
	mathfield.popoverPolicy = "off";
	mathfield.environmentPopoverPolicy = "off";
	if (restrictedMode) mathfield.setAttribute("data-pie-restricted", "true");
}
