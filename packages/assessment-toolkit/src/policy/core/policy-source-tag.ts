/**
 * Policy source tag — attribution for `ToolPolicyEntry.sources`.
 *
 * The engine attaches a `PolicySourceTag` to every `ToolPolicyEntry` it
 * emits, capturing every step from `compose-decision.ts` that contributed
 * to the entry being kept (or, in the case of `qti-required-blocked`,
 * the step that surfaced the conflict).
 *
 * Tag vocabulary maps onto the six composition steps in
 * `m8-design.md` § 3:
 *
 *   1. Membership filter   → `"placement"`
 *   2. Provider veto       → `"provider"` (negative; only present when
 *                                            the entry survived a
 *                                            non-`enabled: false` check)
 *   3. Host whitelist      → `"policy"`
 *   4. Host blocklist      → `"policy"` (negative)
 *   5. QTI gates           → `"qti.${rule}"` (e.g. `"qti.pnp-support"`,
 *                                              `"qti.item-requirement"`)
 *   6. Custom PolicySources → `"custom.${source.id}"`
 *
 * Negative tags do not appear on surviving entries — they are reflected
 * only in `ToolPolicyProvenance` decisions. The tag union therefore
 * tracks contributors that *kept* a tool, not contributors that
 * *removed* one. Diagnostic surfacing of removals is the
 * provenance/diagnostic channel's job.
 */

export type QtiPolicySourceRule =
	| "district-block"
	| "test-admin-override"
	| "item-restriction"
	| "item-requirement"
	| "district-requirement"
	| "pnp-support"
	| "pnp-prohibited";

export type QtiPolicySourceTag = `qti.${QtiPolicySourceRule}`;

export type CustomPolicySourceTag = `custom.${string}`;

export type PolicySourceTag =
	| "placement"
	| "policy"
	| "provider"
	| QtiPolicySourceTag
	| CustomPolicySourceTag;
