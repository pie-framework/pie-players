import type { ItemFeatureDecision } from "@pie-players/pie-context";
import type { ConfigWithModels, ItemFeatureApplier } from "./item-features.js";

type Model = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Model =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** A model's direct children that declare their own autoplay, as EBSR's parts do. */
const declaringChildKeys = (model: Model): string[] =>
	Object.keys(model).filter(
		(key) =>
			isPlainObject(model[key]) &&
			Object.hasOwn(model[key] as Model, "autoplayAudioEnabled"),
	);

/** The decision's fields, written onto a model or a declaring child. */
const decisionFields = (decision: ItemFeatureDecision): Model =>
	decision.granted ? { autoplayAudioEnabled: true } : { autoplayAudioHeld: true };

/**
 * The item's prompt-audio autoplay, set by the `autoplay-audio-enabled`
 * attribute and the toolkit's `autoplayAudio` decision.
 *
 * The attribute overwrites `autoplayAudioEnabled` on every top-level model. A
 * decision then lands on every model and on each direct child declaring
 * `autoplayAudioEnabled`: a hold as `autoplayAudioHeld: true`, which leaves
 * `autoplayAudioEnabled` as it was so an element version that predates the
 * field autoplays as authored, and a grant as `autoplayAudioEnabled: true`.
 *
 * Authored `autoplay` attributes are removed, so audio and video in the item's
 * markup start only through the model setting.
 */
export const autoplayAudioApplier: ItemFeatureApplier<boolean> = {
	featureId: "autoplayAudio",
	markupRules: [{ kind: "attribute", name: "autoplay" }],
	apply(configEntity, attribute, decision) {
		// What the decision displaces: autoplay on for a hold, off for a grant.
		const displaced = decision ? !decision.granted : undefined;
		let authoredDisplaced = false;
		const models = configEntity.models.map((source) => {
			const model: Model = { ...(source as Model) };
			if (attribute !== undefined) model.autoplayAudioEnabled = attribute;
			if (!decision) return model;
			if (model.autoplayAudioEnabled === displaced && attribute === undefined) {
				authoredDisplaced = true;
			}
			Object.assign(model, decisionFields(decision));
			for (const key of declaringChildKeys(model)) {
				const child = model[key] as Model;
				if (child.autoplayAudioEnabled === displaced) authoredDisplaced = true;
				model[key] = { ...child, ...decisionFields(decision) };
			}
			return model;
		});
		const config = { ...configEntity, models } as ConfigWithModels;
		if (!decision) return { config };
		const overrode =
			attribute === displaced
				? "attribute"
				: authoredDisplaced
					? "authored"
					: undefined;
		return { config, ...(overrode ? { overrode } : {}) };
	},
};
