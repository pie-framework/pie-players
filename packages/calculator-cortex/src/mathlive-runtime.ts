import type { MathfieldElement } from "mathlive";
import type { CortexCalculatorLocalization } from "./localization.js";

/*
 * `MathfieldElement.locale` and `.decimalSeparator` are static properties of the
 * element class, so they are process-wide state shared with every other mathfield
 * on the page — a host's own, and a second calculator's. This lease is what makes
 * setting them reversible: the first acquirer captures what it found, each later
 * one takes ownership, and only the current owner's release puts the captured
 * values back. Without it a calculator raised the page's mathfields to its own
 * locale permanently, and a `nl-NL` calculator left every later field parsing `,`
 * as the decimal separator after it closed.
 *
 * A single static property still cannot hold two locales at once, so two
 * calculators open at different locales share whichever acquired last. That is
 * MathLive's shape, not something a lease can fix; what the lease guarantees is
 * that the page returns to its own setting when the calculators are gone.
 *
 * MathLive's *virtual keyboard* is deliberately absent here. This package renders
 * its own keypad (see `keypad-layouts.ts`: MathLive's is a viewport-fixed
 * singleton containing no focusable elements, so it cannot be operated by
 * keyboard or switch access at all), and the code that swapped layouts into that
 * singleton was unreachable — every call site turned it off.
 */

const LEASE_KEY = Symbol.for("pie-players.calculator-cortex.mathlive-keyboard");

interface MathfieldSettings {
	locale: string;
	decimalSeparator: "." | ",";
}

interface SettingsLease {
	owner: symbol;
	baseLocale: string;
	baseDecimalSeparator: "." | ",";
}

type LeaseGlobal = typeof globalThis & {
	[LEASE_KEY]?: SettingsLease;
};

function decimalSeparator(locale: string): "." | "," {
	try {
		const formatted = new Intl.NumberFormat(locale).format(1.1);
		return formatted.includes(",") ? "," : ".";
	} catch {
		return ".";
	}
}

/**
 * Point the mathfield class at this calculator's locale, and return the release
 * that puts the page's own setting back.
 *
 * Idempotent per owner: re-acquiring only moves ownership, so a caller that
 * acquires on every focus does not rebuild anything.
 */
export function acquireMathfieldSettings(
	owner: symbol,
	localization: CortexCalculatorLocalization,
	mathfieldConstructor: MathfieldSettings,
): () => void {
	const leaseGlobal = globalThis as LeaseGlobal;
	const lease: SettingsLease = leaseGlobal[LEASE_KEY] ?? {
		owner,
		baseLocale: mathfieldConstructor.locale,
		baseDecimalSeparator: mathfieldConstructor.decimalSeparator,
	};
	lease.owner = owner;
	leaseGlobal[LEASE_KEY] = lease;
	mathfieldConstructor.locale = localization.locale;
	mathfieldConstructor.decimalSeparator = decimalSeparator(localization.locale);

	return () => {
		const current = leaseGlobal[LEASE_KEY];
		if (!current || current.owner !== owner) return;
		mathfieldConstructor.locale = current.baseLocale;
		mathfieldConstructor.decimalSeparator = current.baseDecimalSeparator;
		delete leaseGlobal[LEASE_KEY];
	};
}

/** Which decimal separator a locale writes, exposed for the keypad's own key. */
export { decimalSeparator as mathfieldDecimalSeparator };

export function configureMathfield(
	mathfield: MathfieldElement,
	label: string,
	restrictedMode: boolean,
): void {
	mathfield.setAttribute("aria-label", label);
	/*
	 * `"manual"`, always. Under `"auto"` MathLive registers a global focusin handler
	 * whenever `isTouchCapable()` — every touchscreen Chromebook and tablet — and
	 * shows its viewport-fixed keyboard shortly after the field gains focus. The
	 * tool wrapper focuses the calculator on open, so `"auto"` means opening the
	 * calculator on a tablet drops a grey keyboard across the bottom of the
	 * assessment, over the result and any error.
	 */
	mathfield.mathVirtualKeyboardPolicy = "manual";
	// Marks the field whose keypad this package owns, which is what hides
	// MathLive's own keyboard toggle in `MathFieldInput.svelte`.
	mathfield.setAttribute("data-pie-own-keypad", "true");
	mathfield.menuItems = [];
	mathfield.smartMode = false;
	mathfield.smartFence = true;
	mathfield.popoverPolicy = "off";
	mathfield.environmentPopoverPolicy = "off";
	if (restrictedMode) mathfield.setAttribute("data-pie-restricted", "true");
}
