import type {
	FeatureDecisionAppliedDetail,
	ItemFeatureDecision,
	ItemFeatureDecisions,
} from "@pie-players/pie-context";
import type { ConfigEntity } from "@pie-players/pie-players-shared";
import { autoplayAudioApplier } from "./autoplay-audio.js";

/** A config whose delivery models an applier writes. */
export type ConfigWithModels = ConfigEntity & { models: unknown[] };

/**
 * A switch in authored markup that a feature's model setting replaces, which
 * the player removes from the item and passage markup in view mode, whatever
 * the policy decides, so the model setting is the feature's only switch.
 * Removal only: a rule never adds to markup, so no kind can undo what the
 * sanitizer removed. A new kind is a new member here and a new case in
 * `applyMarkupRules`.
 */
export type MarkupRule = { kind: "attribute"; name: string };

/**
 * One feature the item player writes onto its item's delivery models. The
 * applier owns the feature's model fields; the registry owns when they are
 * written: on load, on a change to the setting or the decision, and after a
 * backend model refresh, in view mode only.
 */
export interface ItemFeatureApplier<S = unknown> {
	/** The id `ItemFeatureDecisions.features` keys the feature's decision by. */
	readonly featureId: string;
	/**
	 * Writes the feature onto the models, from the player's own setting for it
	 * and the toolkit's decision, at least one of which is present. Returns a
	 * new config, and what the decision displaced when it displaced something.
	 * Re-applying to written models changes nothing.
	 */
	apply(
		config: ConfigWithModels,
		setting: S | undefined,
		decision: ItemFeatureDecision | null,
	): { config: ConfigWithModels; overrode?: FeatureDecisionAppliedDetail["overrode"] };
	/** The markup switches the feature's model setting replaces. */
	readonly markupRules?: readonly MarkupRule[];
}

/**
 * The features the item player applies, each id one the toolkit's
 * `ITEM_PLAYER_FEATURE_IDS` lists. A new feature is an applier added here and
 * its id added there.
 */
export const ITEM_FEATURE_APPLIERS: readonly ItemFeatureApplier[] = [
	autoplayAudioApplier,
];

/** Decisions keyed by the feature ids the player applies. */
export type AppliedFeatureDecisions = Readonly<
	Record<string, ItemFeatureDecision>
>;

export interface ItemFeatureInputs {
	mode: "view" | "author";
	/** The player's own setting per feature id, such as an attribute; absent when unset. */
	settings: Readonly<Record<string, unknown>>;
	decisions: AppliedFeatureDecisions;
}

const NO_DECISIONS: AppliedFeatureDecisions = Object.freeze({});

/**
 * The decisions in a context value that `appliers` apply, leaving out ids no
 * rule names and malformed entries.
 */
export function readItemFeatureDecisions(
	value: ItemFeatureDecisions | null | undefined,
	appliers: readonly ItemFeatureApplier[],
): AppliedFeatureDecisions {
	const features = value?.features;
	if (!features) return NO_DECISIONS;
	const decisions: Record<string, ItemFeatureDecision> = {};
	for (const { featureId } of appliers) {
		const decision = features[featureId];
		if (
			!decision ||
			typeof decision.granted !== "boolean" ||
			typeof decision.rule !== "string" ||
			decision.rule === "none"
		) {
			continue;
		}
		decisions[featureId] = { granted: decision.granted, rule: decision.rule };
	}
	return decisions;
}

/** Whether two reads carry the same verdicts and rules. */
export function sameItemFeatureDecisions(
	a: AppliedFeatureDecisions,
	b: AppliedFeatureDecisions,
): boolean {
	const ids = Object.keys(a);
	if (ids.length !== Object.keys(b).length) return false;
	return ids.every(
		(id) => a[id].granted === b[id]?.granted && a[id].rule === b[id]?.rule,
	);
}

/**
 * What a load writes onto the models, for the load's no-op guard: a change
 * re-enters the load, since elements read these settings at mount. A rule
 * change alone writes nothing new.
 */
export function itemFeaturesSignature(
	inputs: ItemFeatureInputs,
	appliers: readonly ItemFeatureApplier[],
): string {
	if (inputs.mode === "author") return "author";
	return JSON.stringify(
		appliers.map(({ featureId }) => [
			featureId,
			inputs.settings[featureId] ?? null,
			inputs.decisions[featureId]?.granted ?? null,
		]),
	);
}

const markupCandidates = (markup: string, rules: readonly MarkupRule[]) => {
	const lower = markup.toLowerCase();
	return rules.filter((rule) => lower.includes(rule.name.toLowerCase()));
};

/**
 * Removes what `rules` name from `markup`. Markup that mentions none of them
 * is returned as given, without a parse, so trusted markup keeps its exact
 * text unless a rule applies to it. Without a document, as during SSR, the
 * markup is returned as given.
 */
export function applyMarkupRules(
	markup: string,
	rules: readonly MarkupRule[],
	doc: Document | null = globalThis.document ?? null,
): string {
	if (!markup || !doc) return markup;
	const candidates = markupCandidates(markup, rules);
	if (candidates.length === 0) return markup;
	const template = doc.createElement("template");
	template.innerHTML = markup;
	let removed = false;
	for (const rule of candidates) {
		switch (rule.kind) {
			case "attribute":
				for (const element of template.content.querySelectorAll("*")) {
					if (!element.hasAttribute(rule.name)) continue;
					element.removeAttribute(rule.name);
					removed = true;
				}
				break;
		}
	}
	return removed ? template.innerHTML : markup;
}

/**
 * Writes every applier's feature onto a config's delivery models, and removes
 * the appliers' markup rules from its markup. Author mode receives neither, so
 * no delivery setting reaches saved content.
 *
 * `applied` holds one `feature-decision-applied` detail per decision written.
 */
export function applyItemFeatures(
	configEntity: ConfigEntity,
	inputs: ItemFeatureInputs,
	appliers: readonly ItemFeatureApplier[],
): { config: ConfigEntity; applied: FeatureDecisionAppliedDetail[] } {
	if (inputs.mode === "author" || !configEntity) {
		return { config: configEntity, applied: [] };
	}
	const rules = appliers.flatMap((applier) => applier.markupRules ?? []);
	const markup =
		typeof configEntity.markup === "string"
			? applyMarkupRules(configEntity.markup, rules)
			: configEntity.markup;
	const unmarked =
		markup === configEntity.markup ? configEntity : { ...configEntity, markup };
	if (!Array.isArray(unmarked.models)) return { config: unmarked, applied: [] };
	let config = unmarked as ConfigWithModels;
	const applied: FeatureDecisionAppliedDetail[] = [];
	for (const applier of appliers) {
		const setting = inputs.settings[applier.featureId];
		const decision = inputs.decisions[applier.featureId] ?? null;
		if (setting === undefined && !decision) continue;
		const result = applier.apply(config, setting, decision);
		config = result.config;
		if (!decision) continue;
		applied.push({
			featureId: applier.featureId,
			granted: decision.granted,
			rule: decision.rule,
			...(result.overrode ? { overrode: result.overrode } : {}),
		});
	}
	return { config, applied };
}

/**
 * One detail per feature for a load that wrote onto the item and its passage:
 * the attribute outranks authored content as what a decision overrode.
 */
export function mergeAppliedFeatures(
	...lists: FeatureDecisionAppliedDetail[][]
): FeatureDecisionAppliedDetail[] {
	const merged = new Map<string, FeatureDecisionAppliedDetail>();
	for (const entry of lists.flat()) {
		const previous = merged.get(entry.featureId);
		if (!previous) {
			merged.set(entry.featureId, entry);
			continue;
		}
		const overrode =
			previous.overrode === "attribute" || entry.overrode === "attribute"
				? "attribute"
				: previous.overrode === "authored" || entry.overrode === "authored"
					? "authored"
					: undefined;
		const { overrode: _previous, ...base } = previous;
		merged.set(entry.featureId, { ...base, ...(overrode ? { overrode } : {}) });
	}
	return [...merged.values()];
}
