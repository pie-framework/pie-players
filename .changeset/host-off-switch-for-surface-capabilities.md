---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

`tools.policy.blocked` now decides feature-scoped capabilities too, so a host can
decline one that renders as its own surface.

`decideFeature(...)` consulted only the PNP source. The host gates —
`tools.policy.blocked`, and `tools.policy.allowed` read as an allow-list — were
applied in `composeDecision(...)`, which serves the placement-scoped path only.
So the one lever that names capabilities rather than placements was inert for
exactly the capabilities it was the sole lever for: configuration validation
rejects a `region` capability from `tools.placement`, and the feature path
deliberately ignores placement, which left a host with nothing to write.

That became load-bearing when the audio transcript shipped as a packaged
capability. It declares `resolvesWithoutGrant`, and an authored
`visibility: "always"` card resolves without consulting the grant at all, so no
profile, district policy or test administration could keep it off the page.
Declining it meant adopting `@pie-players/pie-default-tool-loaders` and composing
a registry by hand — the programmatic path, for a host that had deliberately
stayed on the custom-element one.

A host denial outranks `resolvesWithoutGrant`. The flag says the capability may
answer from the content when policy granted nobody; a blocklist entry says the
capability has no place in this delivery, which is not a question the content gets
to reopen. Section-player gates on the registration's `toolId` as well as its
`pnpSupportIds`, because `tools.policy` names capabilities and a host blocking
`transcript` means the capability whatever support id it resolves through.

`provider-disabled` and `placement-membership` stay out of the feature path: both
are statements about a toolbar the capability was never on.

Two additive surfaces come with it. `FeaturePolicyDecision.rule` widens to
`FeaturePolicyRule`, adding the `host-blocked` and `host-allowlist` members
`ToolPolicyDecisionRule` already carried, and `precedence` admits `0` — the same
values `composeDecision(...)` records, so a policy debugger reads one vocabulary
for both paths. `isHostDeniedFeature(decision)` is the predicate that tells a host
gate apart from an absent grant.
