/**
 * PNP/profile policy input detection. See
 * `docs/tools-and-accomodations/architecture.md`.
 *
 * Pure helpers that decide whether policy inputs carry PNP/profile policy
 * material, which is what auto-mode `pnpEnforcement` turns on for. The engine
 * resolves auto-mode per decision: the bound assessment for every decision, and
 * for a decision scoped to an item, that item's settings as well.
 *
 * The rule is intentionally narrow. Hosts that bind a bare assessment
 * record (only `id` / `name`, no PNP and no settings) do not engage
 * PNP/profile gates. The flip happens the moment the assessment carries any of:
 *
 *   - `personalNeedsProfile` (any `supports` or `prohibitedSupports`),
 *   - `settings.districtPolicy` (any `blockedTools` or `requiredTools`),
 *   - `settings.testAdministration` (any `toolOverrides` entry),
 *   - or, for an item-scoped decision, the item's settings carry
 *     `requiredTools` / `restrictedTools`.
 *
 * Tool parameters are no policy material: the engine resolves them whatever the
 * enforcement state.
 *
 * Hosts opt out of the auto-on behavior by passing
 * `pnpEnforcement: "off"` explicitly (engine input or
 * `ToolkitCoordinator.setPnpEnforcement("off")`).
 */

import type {
	AssessmentEntity,
	ItemSettings,
} from "@pie-players/pie-players-shared/types";

const hasEntries = (value: unknown): boolean =>
	Array.isArray(value) && value.length > 0;

/**
 * Return `true` when the assessment carries any PNP/profile policy
 * material that the engine's `PnpPolicySource` would consume.
 *
 * The check is structural — a non-empty field the source reads is enough;
 * the content does not have to validate against any specific rule.
 */
export function assessmentHasPnpPolicyInputs(
	assessment: AssessmentEntity | null | undefined,
): boolean {
	if (!assessment) return false;
	const pnp = assessment.personalNeedsProfile;
	if (pnp && (hasEntries(pnp.supports) || hasEntries(pnp.prohibitedSupports))) {
		return true;
	}
	const settings = assessment.settings;
	if (settings) {
		const district = settings.districtPolicy;
		if (
			district &&
			(hasEntries(district.blockedTools) || hasEntries(district.requiredTools))
		) {
			return true;
		}
		const overrides = settings.testAdministration?.toolOverrides;
		if (
			overrides &&
			typeof overrides === "object" &&
			Object.keys(overrides).length > 0
		) {
			return true;
		}
	}
	return false;
}

/**
 * Return `true` when an item's settings carry item-level profile policy
 * material (`requiredTools` or `restrictedTools`).
 *
 * Used in addition to {@link assessmentHasPnpPolicyInputs} for a decision scoped
 * to the item, so an item with profile-relevant settings engages PNP/profile
 * gates on its own toolbar without a parent assessment carrying a
 * PNP/district/test-admin block.
 */
export function itemSettingsHavePnpPolicyInputs(
	settings: ItemSettings | null | undefined,
): boolean {
	if (!settings) return false;
	return hasEntries(settings.requiredTools) || hasEntries(settings.restrictedTools);
}

/**
 * Resolve the auto-mode `pnpEnforcement` for one decision.
 *
 * Returns `"on"` when {@link assessmentHasPnpPolicyInputs} reports profile
 * policy material, or when `itemSettings` (the settings of the item a decision
 * is scoped to) do per {@link itemSettingsHavePnpPolicyInputs}; otherwise
 * `"off"`. Hosts override the default by passing an explicit `pnpEnforcement`
 * value (engine input) or by calling
 * `ToolkitCoordinator.setPnpEnforcement("on" | "off")`.
 */
export function resolveDefaultPnpEnforcement(args: {
	assessment?: AssessmentEntity | null;
	itemSettings?: ItemSettings | null;
}): "on" | "off" {
	if (assessmentHasPnpPolicyInputs(args.assessment)) return "on";
	if (itemSettingsHavePnpPolicyInputs(args.itemSettings)) return "on";
	return "off";
}
