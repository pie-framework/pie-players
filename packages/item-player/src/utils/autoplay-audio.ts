import type {
	FeatureDecisionAppliedDetail,
	ItemFeatureDecisions,
} from "@pie-players/pie-context";
import type { ConfigEntity } from "@pie-players/pie-players-shared";

/** The toolkit's `autoplayAudio` decision on the item. */
export interface AutoplayAudioDecision {
	effect: "held" | "enabled";
	/** The deciding rule, as the toolkit names it. */
	rule: string;
}

/** The `autoplayAudio` decision in a context value; `null` when no rule names it. */
export function resolveAutoplayAudioDecision(
	value: ItemFeatureDecisions | null | undefined,
): AutoplayAudioDecision | null {
	const decision = value?.features?.autoplayAudio;
	if (
		!decision ||
		typeof decision.granted !== "boolean" ||
		typeof decision.rule !== "string" ||
		decision.rule === "none"
	) {
		return null;
	}
	return { effect: decision.granted ? "enabled" : "held", rule: decision.rule };
}

export interface AutoplayAudioInputs {
	mode: "view" | "author";
	/** The `autoplay-audio-enabled` attribute. */
	attribute: boolean | undefined;
	decision: AutoplayAudioDecision | null;
}

/**
 * What a load writes onto the models, for the load's no-op guard: a change
 * re-enters the load, since elements read autoplay at mount.
 */
export function autoplayAudioSignature(inputs: AutoplayAudioInputs): string {
	if (inputs.mode === "author") return "author";
	return `${inputs.attribute ?? "unset"}|${inputs.decision?.effect ?? "none"}`;
}

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
const decisionFields = (decision: AutoplayAudioDecision): Model =>
	decision.effect === "held"
		? { autoplayAudioHeld: true }
		: { autoplayAudioEnabled: true };

/**
 * Writes the item's autoplay onto its delivery models.
 *
 * The attribute overwrites `autoplayAudioEnabled` on every top-level model. A
 * decision then lands on every model and on each direct child declaring
 * `autoplayAudioEnabled`: a hold as `autoplayAudioHeld: true`, which leaves
 * `autoplayAudioEnabled` as it was so an element version that predates the
 * field autoplays as authored, and a grant as `autoplayAudioEnabled: true`.
 * Author mode receives neither, so no delivery setting reaches saved content.
 *
 * `applied` describes the decision written, for `feature-decision-applied`;
 * `null` when none was.
 */
export function applyAutoplayAudio(
	configEntity: ConfigEntity,
	inputs: AutoplayAudioInputs,
): { config: ConfigEntity; applied: FeatureDecisionAppliedDetail | null } {
	const { mode, attribute, decision } = inputs;
	if (
		mode === "author" ||
		(attribute === undefined && !decision) ||
		!Array.isArray(configEntity?.models)
	) {
		return { config: configEntity, applied: null };
	}
	// What the decision displaces: autoplay on for a hold, off for a grant.
	const displaced = decision?.effect === "held";
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
	const config = { ...configEntity, models } as ConfigEntity;
	if (!decision) return { config, applied: null };
	const overrode =
		attribute === displaced
			? "attribute"
			: authoredDisplaced
				? "authored"
				: undefined;
	return {
		config,
		applied: {
			featureId: "autoplayAudio",
			effect: decision.effect,
			rule: decision.rule,
			...(overrode ? { overrode } : {}),
		},
	};
}

/**
 * One `feature-decision-applied` for a load that wrote a decision onto the item
 * and its passage: the attribute outranks authored content as what it
 * overrode.
 */
export function mergeAppliedDecisions(
	...applied: Array<FeatureDecisionAppliedDetail | null>
): FeatureDecisionAppliedDetail | null {
	const written = applied.filter(
		(entry): entry is FeatureDecisionAppliedDetail => entry !== null,
	);
	if (written.length === 0) return null;
	const overrode = written.some((entry) => entry.overrode === "attribute")
		? "attribute"
		: written.some((entry) => entry.overrode === "authored")
			? "authored"
			: undefined;
	const { overrode: _first, ...base } = written[0];
	return { ...base, ...(overrode ? { overrode } : {}) };
}
