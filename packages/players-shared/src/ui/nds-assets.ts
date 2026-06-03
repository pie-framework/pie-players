// Side-effect import: registers <nds-icon-button>. Vendored prebuilt bundle —
// see src/vendor/nds/nds-icon-button.js for provenance and refresh instructions.
import "../vendor/nds/nds-icon-button.js";

const FA_PRO_HREFS = ["/_fa-pro/fontawesome.min.css", "/_fa-pro/light.min.css"];
const FA_FREE_HREF =
	"https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css";
const ROBOTO_HREF =
	"https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap";
const FA_LIGHT_SHIM_ID = "pie-nds-fa-light-shim";

let installed = false;

/**
 * Injects the FontAwesome and Roboto stylesheets required by <nds-icon-button>
 * into document.head. All checks are idempotent — safe to call from multiple
 * components on the same page; subsequent calls are no-ops.
 *
 * Load order: FA Free (fallback baseline) → FA Pro from /_fa-pro/ (same-origin
 * proxy). When Pro loads it overrides the fa-light shim with its weight-300
 * font-family; if Pro 404s the shim keeps glyphs visible at Solid weight.
 */
export const ensureNdsAssets = (): void => {
	if (typeof document === "undefined" || installed) return;
	installed = true;

	if (!document.querySelector('link[href*="Roboto"]')) {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = ROBOTO_HREF;
		document.head.appendChild(link);
	}
	if (!document.querySelector(`link[href="${FA_FREE_HREF}"]`)) {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = FA_FREE_HREF;
		document.head.appendChild(link);
	}
	for (const href of FA_PRO_HREFS) {
		if (document.querySelector(`link[href="${href}"]`)) continue;
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = href;
		document.head.appendChild(link);
	}
	if (!document.getElementById(FA_LIGHT_SHIM_ID)) {
		const style = document.createElement("style");
		style.id = FA_LIGHT_SHIM_ID;
		style.textContent = '.fa-light{font-family:"Font Awesome 6 Free";font-weight:900;}';
		document.head.appendChild(style);
	}
};
