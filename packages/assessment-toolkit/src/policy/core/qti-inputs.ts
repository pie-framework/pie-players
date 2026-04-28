/**
 * QTI input detection (M8 PR 4 — see `.cursor/plans/m8-design.md` F2 and
 * `.cursor/plans/m8-implementation-plan.md` § PR 4).
 *
 * Pure helpers that decide whether the inputs the engine has been given
 * actually carry QTI 6-level precedence material. Used by:
 *
 *   - {@link ToolPolicyEngine}'s constructor as the auto-default for
 *     `qtiEnforcement` when the host did not pass an explicit `"on"` /
 *     `"off"`.
 *   - {@link ToolkitCoordinator.resolveEffectiveQtiEnforcement} as the
 *     auto-mode rule. PR 2 used a coarse "any non-null assessment → on"
 *     placeholder; PR 4 narrows it to "assessment OR currentItemRef
 *     carries QTI material."
 *
 * The rule is intentionally narrow. Hosts that bind a bare assessment
 * record (only `id` / `name`, no PNP and no settings) get the legacy
 * floating-tools behavior — QTI gates do not engage. The flip happens
 * the moment the assessment carries any of:
 *
 *   - `personalNeedsProfile` (any `supports`, `prohibitedSupports`, or
 *     `activateAtInit`),
 *   - `settings.districtPolicy` (any `blockedTools`, `requiredTools`,
 *     or `policies`),
 *   - `settings.testAdministration` (any populated key — `mode`,
 *     `toolOverrides`, etc.),
 *   - or the bound `currentItemRef.settings` carries
 *     `requiredTools` / `restrictedTools` / `toolParameters`.
 *
 * Hosts opt out of the auto-on behavior by passing
 * `qtiEnforcement: "off"` explicitly (engine input or
 * `ToolkitCoordinator.setQtiEnforcement("off")`).
 */

import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";

/**
 * Return `true` when the assessment carries any QTI 6-level precedence
 * material that the engine's `QtiPolicySource` would consume.
 *
 * The check is structural — the presence of a non-empty PNP, district
 * policy, or test administration block is enough; the content does not
 * have to validate against any specific rule.
 */
export function assessmentHasQtiInputs(
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
		if (
			Array.isArray(pnp.activateAtInit) &&
			pnp.activateAtInit.length > 0
		) {
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
 * Return `true` when the bound item reference carries item-level QTI
 * material (`requiredTools`, `restrictedTools`, or `toolParameters`).
 *
 * Used in addition to {@link assessmentHasQtiInputs} so a host that
 * navigates to an item with QTI-relevant settings — without a parent
 * assessment carrying its own PNP/district/test-admin block — still
 * gets QTI gates engaged for that item.
 */
export function itemRefHasQtiInputs(
	itemRef: AssessmentItemRef | null | undefined,
): boolean {
	const settings = itemRef?.settings;
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
 * Resolve the default `qtiEnforcement` mode given the bound inputs.
 *
 * Returns `"on"` when {@link assessmentHasQtiInputs} or
 * {@link itemRefHasQtiInputs} reports any QTI material; otherwise
 * `"off"`. Hosts override the default by passing an explicit
 * `qtiEnforcement` value (engine input) or by calling
 * `ToolkitCoordinator.setQtiEnforcement("on" | "off")`.
 */
export function resolveDefaultQtiEnforcement(args: {
	assessment?: AssessmentEntity | null;
	currentItemRef?: AssessmentItemRef | null;
}): "on" | "off" {
	if (assessmentHasQtiInputs(args.assessment)) return "on";
	if (itemRefHasQtiInputs(args.currentItemRef)) return "on";
	return "off";
}
