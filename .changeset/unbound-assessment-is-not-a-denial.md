---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
---

A feature decision reports whether an assessment was bound, so a host that never bound one is distinguishable from a profile that grants nothing.

Both produced `Feature "X" not configured at any level`. The first is a wiring gap and the second is a correct denial, and a deployment that forgot to supply a profile therefore looked exactly like a student who was properly declined — which is how it went unnoticed that Quiz Engine's fixed player, which takes a coordinator from `toolkit-ready` and configures tools through it but never calls `updateAssessment`, cannot deliver signing or a transcript at all.

## `FeaturePolicyDecision.assessmentBound`

The engine already held the discriminant and threw it away: `decideFeature` passes the assessment to `PnpPolicySource.resolveFeature` as `undefined` whether the host bound nothing or bound something silent, so the source cannot tell and the engine can. A denial with nothing bound now carries its own reason in place of the six-level one.

`granted`, `action`, `rule` and `precedence` are unchanged. Fail-closed is the correct behaviour and stays: an accommodation requires a documented need, and an absent profile documents nothing. Naming a seventh rule was the alternative and would have described a precedence level that does not exist — nothing fired, which is the point.

`assessmentBound: false` is not a synonym for denied. An item ref carrying `requiredTools` mandates a feature at precedence 4 with no assessment in sight, and there the source's own reason survives. Read it alongside `granted`.

A bound assessment carrying no profile material is deliberately `true`. A test that grants nobody an accommodation is legitimate configuration; never binding one cannot be, since there is nothing to deliver.

## One report per coordinator

`decideFeaturePolicy` warns the first time it is asked about a feature with nothing bound, naming `updateAssessment` and the three fields policy reads. A feature policy is consulted once per capability per card, so a per-decision warning would bury itself; it is never re-armed, because binding an assessment later is the fix rather than a new occurrence.

## PNP debugger

The panel reads the binding from `getPolicyInputs()` — which it previously narrowed to `pnpEnforcement` alone — and shows a card above the determination when nothing is bound, saying that the accommodations below are declined for want of a profile rather than by a verdict. A coordinator that exposes no inputs leaves it unstated: "cannot tell" must not read as "nothing is bound".
