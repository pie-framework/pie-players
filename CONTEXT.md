# PIE Players Domain Language

This context names concepts shared by PIE Players and its runtime hosts so
behavior and ownership can be discussed consistently.

## Theme Language

**Theme Token**:
A `--pie-*` custom property whose meaning and ownership are recorded in the theme token registry.
_Avoid_: CSS variable, color variable

**Base Theme**:
The complete PIE light or dark token set selected by the `theme` setting, with `auto` selecting between them.
_Avoid_: Default palette, color scheme

**Theme Provider**:
A mapping from a runtime host's design-system values into PIE theme tokens.
_Avoid_: Theme, palette

**Built-in Color Scheme**:
A PIE-owned, complete accessibility palette that replaces every required participating color token. Optional component hooks continue to inherit from the provider when the built-in does not define them.
_Avoid_: Theme, partial overlay

**Registered Custom Scheme**:
A runtime-host-owned partial token overlay with registry metadata and picker discovery.
_Avoid_: Built-in scheme, CSS-only scheme

**CSS-only Scheme**:
A runtime-host-owned, best-effort scheme applied through `data-color-scheme` selectors without registration metadata or managed cascade precedence. It follows the normal cascade in a stylesheet-only integration; a selector competing with a mounted `<pie-theme>` needs `!important` to override its inline managed tokens.
_Avoid_: Registered custom scheme

**Default Scheme**:
The absence of a selected named color scheme, leaving the base theme and provider result in effect.
_Avoid_: Default color palette

**Requested Scheme**:
The color-scheme identifier selected by a runtime host or learner, retained even while no matching registered definition is available.
_Avoid_: Active palette, resolved scheme

**Resolved Scheme**:
The registered built-in or custom scheme currently supplying managed token values for a requested identifier.
_Avoid_: Requested scheme, CSS-only scheme

**Scheme Participation**:
A theme token's classification as required, optional, or excluded for built-in color schemes.
_Avoid_: Token support

**Scheme Preview**:
A picker swatch projected from a scheme resolved over PIE's canonical light Base Theme. It is catalog metadata, not a promise to mirror a host-specific provider or dark Base Theme.
_Avoid_: Authored preview colors, palette thumbnail metadata

**Explicit Theme Override**:
A runtime-host-supplied token value applied after the base theme, provider, and registered scheme.
_Avoid_: Provider value, scheme value

## Relationships

- A **Base Theme** establishes the complete starting token set.
- A **Theme Provider** may replace tokens from the **Base Theme** with runtime-host design-system values.
- A selected **Built-in Color Scheme** replaces every required participating color token after provider resolution.
- A selected **Registered Custom Scheme** partially overlays the resolved tokens after provider resolution.
- An **Explicit Theme Override** has final precedence over the resolved registered theme values.
- A **CSS-only Scheme** remains available as a deliberate host CSS selector hook. It has normal cascade precedence in a stylesheet-only integration and needs `!important` when competing with a mounted `<pie-theme>`; a **Registered Custom Scheme** is the supported path for managed precedence and discovery.
- A built-in scheme identifier is reserved and cannot identify a **Registered Custom Scheme**.
- A **Requested Scheme** without a **Resolved Scheme** retains its identifier while managed rendering falls back to the base theme and provider result.
- A **Scheme Preview** is derived from the same canonical definitions that render the assessment and is never a separately authored palette.

## Example dialogue

> **Dev:** "Does `default` select the light accessibility palette?"
> **Domain expert:** "No. The **Default Scheme** selects no named palette; the **Base Theme** still decides light or dark, then the **Theme Provider** may adapt it."

## Flagged ambiguities

- "theme" previously referred to both light/dark selection and accessibility palettes — resolved: use **Base Theme** for light/dark and **Color Scheme** for a named accessibility palette.
- "custom scheme" previously covered both registered data and host CSS selectors — resolved: distinguish **Registered Custom Scheme** from **CSS-only Scheme**.
- "complete palette" does not mean every non-color token — completeness is defined by **Scheme Participation**.

## Formative Delivery Language

**Try**:
One submitted-for-checking pass over a single item within a delivery session. `tryCount` counts them, `maxTries` bounds them.
_Avoid_: Attempt, submission, retry — `TestAttemptSession` is the assessment administration and `TestAttemptItemSession.attemptCount` counts session realizations, so a third "attempt" is read as one of those.

**Try Outcome**:
The recorded result of one **Try**: a derived correctness value plus the aggregated points and denominator. Derived from element controller outcomes, never authored.
_Avoid_: Score, result

**Correctness**:
The four-valued outcome of a **Try** — correct, partial, incorrect, or unknown. `unknown` is the honest state for an item no loaded controller can score, such as one holding a rubric element.
_Avoid_: Correct/incorrect boolean, pass/fail

**Feedback Reveal**:
What a learner sees after a **Try**, expressed as the `env` PIE projects onto that one item: none, correctness (`mode: "evaluate"`, `role: "student"`), or solution (`role: "instructor"`). PIE selects the render mode; the element draws the feedback.
_Avoid_: Feedback UI, show answer

**Forced Reveal**:
A **Feedback Reveal** a runtime host imposed rather than the learner earned — a teacher-driven "show the answer". Spends no **Try**, ignores the **Try** budget, and states its own reveal level, which supersedes the **Formative Policy**'s until withdrawn.
_Avoid_: Override, unlock

**Formative Policy**:
The resolved per-item rule set — `maxTries`, `feedback`, `revealOn` — after built-in defaults, the section's policy, and the item ref's override are merged in that order.
_Avoid_: Item session control, settings

**Mastery**:
The section-level rollup over **Try Outcomes**: how many items reached full credit and on which **Try**. Items whose **Correctness** is unknown are excluded from the denominator, not scored zero.
_Avoid_: Completion, progress, score

## Formative Delivery Relationships

- A **Formative Policy** is resolved per item; the section supplies the default and the item ref overrides it field by field.
- A **Try** is item-scoped even when the item holds several interactions; there is no per-element **Try**.
- A **Try** produces exactly one **Try Outcome**, whose **Correctness** the section derives and never authors.
- A **Feedback Reveal** is withdrawn when a learner retries, returning the item to the section's own mode. A learner retry also clears a **Forced Reveal**, so the next earned reveal is back at the **Formative Policy**'s level.
- A **Forced Reveal** is bounded only by whether the item delivers formatively at all; the **Try** budget constrains the learner, not the host that set it.
- **Mastery** is a rollup over **Try Outcomes** and is independent of item completion — an item can be complete and unmastered, or mastered and still editable.
- **Correctness** is the vocabulary a timed-media cue gate will be authored against; it is settled by formative delivery rather than by the cue contract.

## Tool Surface Language

**Tool Surface**:
A host-owned, named slot that registered capabilities may fill outside a toolbar. The slot defines where content is rendered, not which capability renders there.
_Avoid_: Tool, capability region

**Tool Surface Host**:
The PIE-owned module that discovers capabilities registered for a **Tool Surface** and owns their eligibility resolution, catalog invalidation, lazy loading, mounting, synchronization, and teardown.
_Avoid_: Surface component, tool renderer

**Content Surface**:
A **Tool Surface** scoped to an item or passage. It can resolve a capability's authored-content dependency from that owner's immutable **Catalog Owner Snapshot**.
_Avoid_: Item-only surface

**Section Surface**:
A **Tool Surface** scoped to the section runtime. It has no item or passage catalog owner context, so it cannot resolve an authored-content dependency.
_Avoid_: Content surface

**Tool Surface Failure**:
A failure in one capability's resolution, loading, rendering, synchronization, or teardown. It is isolated to that capability and reported as a recoverable framework warning; it never changes assessment readiness or blocks other content.
_Avoid_: Runtime failure, assessment error

**Catalog Owner**:
One mounted item or passage whose entity-root, extracted, and model catalogs are registered as a single resolver-owned transaction.
_Avoid_: Catalog source, raw entity

**Catalog Owner View**:
The resolver-bound interface for one **Catalog Owner**. It supplies current immutable snapshots and owner-filtered change observation; it does not expose traversal or capability semantics.
_Avoid_: Scoped resolver

**Catalog Owner Snapshot**:
An immutable, deterministic sequence of the catalog cards visible to one **Catalog Owner** after resolver-owned traversal and precedence. Capabilities interpret their own card types from this snapshot.
_Avoid_: Catalog registry, entity catalogs

**Packaged Capability Composition**:
The PIE-owned composition module that binds each packaged registration to its
element delivery, lazy-loader bootstrap sets, placement and toolbar ordering,
and explicit universal-support policy, then projects the stable public
registries, maps and presets.
_Avoid_: Default tool list, loader catalogue

## Tool Surface Relationships

- `content-lead` and `content-media` are **Content Surfaces** with different geometry.
- `section-overlay` is a **Section Surface**.
- The **Tool Surface Host** owns capability lifecycle behavior shared by all three surfaces.
- The catalog resolver owns entity traversal, owner scoping, registration precedence, and owner-filtered observation; capabilities receive only a **Catalog Owner Snapshot**.
- Lead, docked, and overlay geometry remain adapters over the **Tool Surface Host** interface.
- A surface name belongs to the host; a registered capability declares which surfaces it can fill.
- A **Tool Surface Failure** may omit or preserve one capability depending on lifecycle phase, but never blocks the assessment or another capability.
- The **Packaged Capability Composition** validates PIE-authored relationships
  strictly before release, while host selection remains fail-soft: unknown
  selected ids do not prevent known packaged capabilities from registering.
- Universal support membership is explicit program policy inside the
  **Packaged Capability Composition**; it is validated against registrations but
  never derived from registration membership.
