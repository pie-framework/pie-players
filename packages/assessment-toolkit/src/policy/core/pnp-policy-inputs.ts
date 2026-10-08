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
 *   - `personalNeedsProfile` (any `supports`, `prohibitedSupports`, or
 *     `activateAtInit`),
 *   - `settings.districtPolicy` (any `blockedTools`, `requiredTools`,
 *     or `policies`),
 *   - `settings.testAdministration` (any populated key — `mode`,
 *     `toolOverrides`, etc.),
 *   - or, for an item-scoped decision, the item's settings carry
 *     `requiredTools` / `restrictedTools` / `toolParameters`.
 *
 * Hosts opt out of the auto-on behavior by passing
 * `pnpEnforcement: "off"` explicitly (engine input or
 * `ToolkitCoordinator.setPnpEnforcement("off")`).
 */

import type {
	AssessmentEntity,
	ItemSettings,
} from "@pie-players/pie-players-shared/types";

/**
 * Return `true` when the assessment carries any PNP/profile policy
 * material that the engine's `PnpPolicySource` would consume.
 *
 * The check is structural — the presence of a non-empty PNP, district
 * policy, or test administration block is enough; the content does not
 * have to validate against any specific rule.
 */
export function assessmentHasPnpPolicyInputs(
	assessment: AssessmentEntity | null | undefined,
): boolean {
	if (!assessment) return false;
	const pnp = assessment.personalNeedsProfile;
	if (pnp) {
		if (Array.isArray(pnp.supports) && pnp.supports.length > 0) return true;
		if (
			Array.isArray(pnp.prohibitedSupports) &&
			pnp.prohibitedSupports.length > 0
		) {
			return true;
		}
		if (Array.isArray(pnp.activateAtInit) && pnp.activateAtInit.length > 0) {
			return true;
		}
	}
	const settings = assessment.settings;
	if (settings) {
		const district = settings.districtPolicy;
		if (district) {
			if (
				Array.isArray(district.blockedTools) &&
				district.blockedTools.length > 0
			) {
				return true;
			}
			if (
				Array.isArray(district.requiredTools) &&
				district.requiredTools.length > 0
			) {
				return true;
			}
			if (
				district.policies &&
				typeof district.policies === "object" &&
				Object.keys(district.policies).length > 0
			) {
				return true;
			}
		}
		const admin = settings.testAdministration;
		if (admin && typeof admin === "object") {
			for (const key of Object.keys(admin)) {
				const value = (admin as Record<string, unknown>)[key];
				if (value === undefined || value === null) continue;
				if (Array.isArray(value) && value.length === 0) continue;
				if (
					typeof value === "object" &&
					!Array.isArray(value) &&
					Object.keys(value as Record<string, unknown>).length === 0
				) {
					continue;
				}
				return true;
			}
		}
	}
	return false;
}

/**
 * Return `true` when an item's settings carry item-level profile policy
 * material (`requiredTools`, `restrictedTools`, or `toolParameters`).
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
	if (
		Array.isArray(settings.requiredTools) &&
		settings.requiredTools.length > 0
	) {
		return true;
	}
	if (
		Array.isArray(settings.restrictedTools) &&
		settings.restrictedTools.length > 0
	) {
		return true;
	}
	if (
		settings.toolParameters &&
		typeof settings.toolParameters === "object" &&
		Object.keys(settings.toolParameters).length > 0
	) {
		return true;
	}
	return false;
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
