---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-i18n-generated": patch
---

Formative delivery is renamed for its mechanism, with no aliases left behind:

- The authored policy is `itemSessionControl` on sections and item refs, typed `ItemSessionControlPolicy`, and the module is `@pie-players/pie-players-shared/item-session-control`.
- The controller methods are `recordTry`, `retryItem`, `revealItemFeedback`, `hideItemFeedback` and `getTryProjection`, and the events are `try-recorded` and `feedback-reveal-changed`.
- The persisted session slice and the composition key are `tries`.
- The toolkit's internal event is `pie-try-action`.
- The card's classes are `pie-section-player-check*`, and its data hooks are `data-pie-check-status` and `data-pie-check-action`.
- The interface messages are `player.check.*`.
- The timed-media Try budget value `"not-formative"` is `"none"`.

Nothing flags old names. Content authored with `formative` delivers without the check control, and a session saved with a `formative` slice restores with its Try state cleared.
