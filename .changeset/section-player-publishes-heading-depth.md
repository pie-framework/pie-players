---
"@pie-players/pie-section-player": patch
---

**Heading structure changes for every section-player host.** The player now publishes the heading level its cards occupy, and every descendant derives its outline from it. New `base-heading-level` attribute (1–6, default 2) on `pie-section-player-splitpane`, `-vertical`, `-tabbed` and `-kernel-host`.

Card headings were a hardcoded `<h2>` and nothing was published downward, which produced three defects with one cause:

- **The item's heading was announced twice at one level.** The card renders "Question 3" as an `h2`; the PIE element then rendered a screen-reader-only "Multiple Choice Question" as another `h2`, so assistive technology heard the item type as a sibling of the question rather than a description of it. The item player is now told the level is already filled.
- **Passage structure was flat.** A passage's own title sat at the level of the card's "Passage" group label. The passage player now starts one level deeper, putting the title beneath its label.
- **Authored `data-heading` markup was inert.** A PIE element promotes `<p data-heading="headingN">` to a heading element only once a level is published. Nothing published one, so the semantic passage and prompt headings added in PIE-151 rendered as paragraphs in every host — a completed feature, with content authored against it, producing no structure and no warning.

At the default this yields card `h2` → passage title `h3` → passage content `h4`, and question `h2` → prompt content `h3`, which is the outline PIE-159 specifies for a host that furnishes its own question headings.

The two content kinds derive different levels from the one published value, deliberately: an item card's heading *is* the item's heading, so the element must not add a second at that level; a passage card's heading is a group label, so the passage's title belongs beneath it.

**What hosts should check.** Rendered heading structure changes with no configuration:

- Screen-reader output has one fewer heading per item, and real nesting inside passages.
- Passage titles move from `h2` to `h3`, and new heading elements appear inside passage and prompt content. CSS selecting `h2` inside a passage will stop matching; selectors keyed on `[data-heading]` are unaffected, because the element preserves that attribute through the promotion.
- A host that furnishes no question headings of its own, and therefore wants the element to keep furnishing them, overrides per player: `runtime.player.includeSrHeading = true`. Host values in `runtime.player` continue to win over the published defaults.

The pattern this follows — a fact only the container knows, published for whichever descendant needs it, with a resolution order, a graceful default and a change signal — is written up in `docs/architecture/composition-context.md`, along with the two places in this repo where a missing change signal made resolvers pin the first value they saw.
