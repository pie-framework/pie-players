---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
---

Withdraw the answer eliminator from items it cannot act on, including for a
learner whose profile grants answer masking.

`hasChoiceInteraction` matched an item model's `element` against a list of choice
interactions, then fell through to "any model carrying a non-empty `choices`
array" for configs that name no element. `placement-ordering`, `categorize` and
`drag-in-the-blank` each hold their draggables in `choices`, so the fallback
answered `true` for all three and the toolbar offered an eliminator whose
controls do nothing on those items (PIE-935). The fallback now applies only to a
model with no element name, which is the case it was written for; a named model
is answered by the list alone, as the element-level branch has always done.

That alone did not remove the button. A PNP-granted tool skips the relevance
gate, deliberately — a heuristic must not withdraw an accommodation a learner is
entitled to — and every profile granting `answerMasking`, `answerEliminator` or
`strikethrough` took that path. So a registration may now declare
`isApplicableToContent(context)`, a capability veto that a grant does not
survive: it answers whether the tool can act on this content at all, where
`isVisibleInContext` answers whether it is plausibly useful. The answer
eliminator declares it, and `ItemToolBar` applies it as a third pass after
policy and relevance.

The two gates are not interchangeable. A calculator is applicable to every item
and merely relevant to some, so it declares only the relevance gate and a
granted calculator still reaches an item that does not look mathematical.
Declare the veto only where the tool's controls provably do nothing: a false
negative withdraws an entitlement, which is the more expensive failure. A gate
that throws, unresolved content, and a host that resolves the tool's visibility
itself all leave the tool in place.

`ToolRegistration` gains one optional method, so a host writing its own
registrations is unaffected until it opts in. No recorded consumer places the
answer eliminator, so no host's rendered toolbar changes. PIE-917 still covers
replacing the element-name list with the capability contract.
