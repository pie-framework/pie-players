# @pie-players/pie-i18n-generated

Machine-generated, **unreviewed** interface locale catalogs for PIE players —
the optional tier beneath the reviewed catalogs that
[`@pie-players/pie-players-shared/i18n`](../players-shared/src/i18n/README.md)
ships. Every catalog here is generated from the English source against a
per-locale terminology brief, is provenance-marked, and is **not** presented
as reviewed: the coverage number certifies structure (keys, placeholders,
plural shape, freshness), never translation quality.

Installing this package changes nothing on its own. A host opts in per
deployment by wiring the loaders into the provider; a host that never sets a
generated locale fetches nothing, because every catalog is a lazy chunk
behind a static `import()` map and the default locale (`en-US`) is statically
resident in `players-shared` and never hits a loader at all.

## Wiring

```ts
import {
	BUNDLED_LOCALES,
	createPieI18n,
	loadBundledCatalog,
} from "@pie-players/pie-players-shared/i18n";
import {
	GENERATED_LOCALES,
	loadGeneratedCatalog,
} from "@pie-players/pie-i18n-generated";

const i18n = createPieI18n({
	availableLocales: [...BUNDLED_LOCALES, ...GENERATED_LOCALES],
	// Bundled first: a reviewed catalog silently wins over a generated one for
	// the same tag, so promoting a locale out of this package into the
	// reviewed set needs no host action.
	loadCatalog: (locale) =>
		loadBundledCatalog(locale).catch(() => loadGeneratedCatalog(locale)),
});

// Hand the provider to the player; the element's `locale` names the locale
// and is the only thing that drives it. Built without `locale` on purpose:
// the factory names a tag without loading its catalog.
document.querySelector("pie-section-player-splitpane").runtime = { i18n };
```

```html
<pie-section-player-splitpane locale="th-TH" …></pie-section-player-splitpane>
```

Hosts may also override individual strings of a generated catalog the same
way they override reviewed ones: `customMessages` is consulted ahead of any
loaded catalog.

## Locales

| Tag | Status | Brief | Generated |
| --- | --- | --- | --- |
| `th-TH` | reviewed (agent pass in lieu of a native reader, 2026-11-03) | [`briefs/th-TH.md`](./briefs/th-TH.md) | 2026-10-19 |
| `en-GB` | reviewed (agent verification pass, 2026-11-03; delta locale) | [`briefs/en-GB.md`](./briefs/en-GB.md) | 2026-10-19 |
| `en-AU` | reviewed (agent verification pass, 2026-11-03; delta locale) | [`briefs/en-AU.md`](./briefs/en-AU.md) | 2026-10-19 |
| `es` | reviewed (agent pass in lieu of a native reader, 2026-11-03; Latin-American neutral; serves `es*`) | [`briefs/es.md`](./briefs/es.md) | 2026-10-19 |
| `fr` | reviewed (agent pass in lieu of a native reader, 2026-11-03; France flavour; serves `fr*`) | [`briefs/fr.md`](./briefs/fr.md) | 2026-10-19 |
| `ar` | reviewed (agent pass in lieu of a native reader, 2026-11-04, after the RTL layout audit below landed; MSA; serves `ar*`; RTL) | [`briefs/ar.md`](./briefs/ar.md) | 2026-10-19 |
| `pt` | reviewed (agent pass in lieu of a native reader, 2026-11-03; Brazilian; serves `pt*`) | [`briefs/pt.md`](./briefs/pt.md) | 2026-10-19 |
| `ko` | reviewed (agent pass in lieu of a native reader, 2026-11-03) | [`briefs/ko.md`](./briefs/ko.md) | 2026-10-19 |
| `ja` | reviewed (agent pass in lieu of a native reader, 2026-11-03) | [`briefs/ja.md`](./briefs/ja.md) | 2026-10-19 |
| `zh` | reviewed (agent pass in lieu of a native reader, 2026-11-03; Simplified; serves `zh`, `zh-CN`, `zh-SG`; Traditional hosts supply `customMessages`) | [`briefs/zh.md`](./briefs/zh.md) | 2026-10-19 |
| `cy` | reviewed (agent pass in lieu of a native reader, 2026-11-03; serves `cy`, `cy-GB`; six CLDR plural categories) | [`briefs/cy.md`](./briefs/cy.md) | 2026-10-19 |
| `sv` | reviewed (agent pass in lieu of a native reader, 2026-11-03; serves `sv`, `sv-SE`, `sv-FI`) | [`briefs/sv.md`](./briefs/sv.md) | 2026-10-19 |
| `ro` | reviewed (agent pass in lieu of a native reader, 2026-11-03; serves `ro`, `ro-RO`, `ro-MD`; three CLDR plural categories, `other` takes `de`) | [`briefs/ro.md`](./briefs/ro.md) | 2026-10-19 |
| `vi` | reviewed (agent pass in lieu of a native reader, 2026-11-03; serves `vi`, `vi-VN`; one CLDR plural category) | [`briefs/vi.md`](./briefs/vi.md) | 2026-11-03 |
| `nl-NL` | reviewed (**native-speaker audit** — the framework's audit language; carried over from `players-shared`'s bundled set on 2026-11-04, verbatim) | [`briefs/nl-NL.md`](./briefs/nl-NL.md) | 2026-10-18 |

Locale tags are chosen for variant reach: bare tags (`es`, `fr`, `ar`) let
`es-MX`, `fr-CA` and `ar-SA` widen onto them through RFC 4647 lookup, while
`en-GB`/`en-AU` are regional on purpose so bare `en` keeps resolving to the
bundled English.

Provenance — the exact `en-US` source hash each catalog was generated from,
the generating model and date — is recorded in
[`catalog-manifest.json`](./catalog-manifest.json).

The `calibration/` directory holds a pipeline measurement against the one
locale that has audited ground truth (Dutch), not a shippable catalog. See
[`calibration/nl-NL-calibration.md`](./calibration/nl-NL-calibration.md) for
what the pipeline does and does not deliver, and what that means for reviewing
a generated locale.

## Checks

```bash
bun run check:i18n-generated
```

runs `scripts/check-catalogs.ts`, which fails on:

- **staleness** — per the locale's status: a `generated` locale whose recorded
  `en-US` hash no longer matches the current English source (its untranslated
  keys would silently fall back to English); a `reviewed` locale whose English
  snapshot no longer matches current English, listing exactly the keys whose
  English moved;
- **key drift** — a missing key, or a key English no longer defines;
- **placeholder drift** — a lost `{name}` slot or an invented one, in string
  or plural-group leaves;
- **plural shape** — a missing plural group, or a group without `other`;
- **manifest disagreement** — a locale present in the loader map but not the
  manifest, or the reverse.

The check runs in the repository's pre-commit and CI gates: changing English
fails the gate until the affected catalogs are regenerated — wholesale for
`generated` locales, surgically for `reviewed` ones.

## The review lifecycle

**Agent passes in lieu of native readers.** On 2026-11-03 `es`, `en-GB` and
`en-AU` were promoted on agent passes: no native readers were available, the
maintainer accepted agent review for them, and each manifest entry's
`reviewedBy` records exactly that. `reviewed` still means *a pass happened and
its work is anchored* — the pass's nature lives in the manifest, the native
pass remains open work, and because regeneration is surgical from here, a
later native pass corrects in place instead of starting over.

A locale moves through two statuses, recorded in `catalog-manifest.json`, and
what regeneration may touch follows from the status:

**`generated` — machine output, no reader behind it.** Regeneration is
wholesale, and losing nothing makes that safe:

1. Read `briefs/<locale>.md`, then regenerate `src/messages/<locale>.ts` from
   the current `packages/players-shared/src/i18n/messages/en-US.ts`, keeping
   every `{placeholder}` slot and the plural-group shape.
2. Update `catalog-manifest.json`: the new `source.hash` (sha256 over the
   JSON serialization of the `en-US` default export), and the locale's
   `generatedAt` and `model`.
3. Run `bun run check:i18n-generated` until it passes.

**Taking a review pass** promotes the locale in place, and this is the step
that makes iteration to audited quality a ratchet instead of a treadmill:

1. A native reader goes through the catalog — the calibration report's
   finding list is the checklist — correcting the file in place.
2. Flip the locale's `status` to `reviewed` in the manifest, add `reviewedAt`
   (and a `reviewedBy` note if wanted), and keep `sourceHash` as the
   generation it started from.
3. Run `bun run scripts/write-english-snapshot.ts <locale>`, which anchors
   the corrections to the English they were reviewed against
   (`src/messages/<locale>.english-snapshot.json`).
4. `bun run check:i18n-generated` passes again — and from now on, changing a
   translated string is preserved work: only keys whose *English* changed
   ever need regenerating.

**`reviewed` — regeneration is surgical, never wholesale.** When the gate
lists keys whose English moved:

1. Regenerate **only the listed keys**, against the brief and the new English
   strings. Every translation the gate does not name stays exactly as the
   review left it.
2. Refresh the anchor:
   `bun run scripts/write-english-snapshot.ts <locale>`.
3. `bun run check:i18n-generated` until it passes.

Wholesale regeneration of a `reviewed` locale discards review work; do it
only deliberately, by flipping the status back to `generated` first.

## The RTL layout audit (`ar`)

Status: **landed 2026-11-04**, and `ar`'s promotion followed it. This section
is the audit's record; the checks it added run in the suite.

`ar` is the framework's first right-to-left interface locale, and the audit
that gated its review pass was a layout audit, not a translation one: a native
reviewer certifying strings that render mirrored would certify the wrong
product. `direction` derives from `Intl.Locale.prototype.textInfo` and the
shell stamps `lang`/`dir` on its own host
([adoption record](../../docs/architecture/i18n-interface-locale-adoption.md)).

`packages/section-player/tests/section-player-rtl-layout.spec.ts` holds seven
rendered cases against the `ar` demo
(`/interface-locale?locale=ar`), run outside the sandbox per the repository's
Playwright rules:

1. **Card header** (pre-existing): the item toolbar hugs the trailing edge,
   under a forced `dir` and under the real `ar` stamps.
2. **Card footer**: the formative check-answer button mirrors under the same
   `margin-inline-start` trailing-edge rule (`/formative-delivery`, forced
   `dir` — the rule reads inherited direction, and case 1 proves the stamping
   path end to end).
3. **Split-pane layout**: pane *order* flips — passages pane leads in LTR,
   trails in RTL; containment stays with the scroll contract.
4. **Toolbar pane**: the shell's toolbar pane hugs the trailing viewport edge
   and follows the direction (right under LTR, left under `ar`); the vertical
   tool column's reading order is direction-independent by design and is
   pinned as stable.
5. **Tool windows at `document.body`**: the graph shell's contents mirror
   (title leads from the right under `ar`) while its screen position and size
   stay put — the adoption record's free-window rule.
6. **Metrics**: no chrome control clips (`scrollWidth` past the box) and no
   horizontal page overflow appears under `ar`; the sweep covers the chrome
   subtrees through the custom elements' open shadow roots and excludes the
   item players' content roots, which are the content-language channel.
7. **Text-level rendered inspection** (recorded, not asserted): a full-page
   screenshot of the `ar` demo was inspected — Arabic labels sit at the
   trailing edges with Western digits per the brief, English content keeps
   its own LTR inside the content root's `dir="auto"`, and no punctuation
   strands on the wrong side of an embedded Latin run in the rendered chrome.

**Defect found and repaired by the audit**: the toolbar pane's divider was a
physical `border-left`/`border-right`
(`SectionPlayerShell.svelte`), so under RTL the divider rendered on the
pane's outer screen edge instead of the content side. It now uses
`border-inline-start`/`border-inline-end`, and case 4's pane-flip assertion
pins the geometry.

**Recorded without assertions** — the surfaces the section demo cannot
exercise: the toolbar scrolls rather than collapsing into an overflow menu
when it overflows, and its tooltips are the browser's `title` rendering, so
neither has an assertion to carry; Back/Next navigation chrome belongs to the
assessment player (the reference assembly), not this building block; the
standalone item player (`<pie-item-player>` on its own) has no locale-driven
demo route, so its chrome mirror is covered only at the stamp level (the
interface-locale spec asserts its content-root stamps) — a follow-up demo
route would close that.

## Adding a locale

Add `briefs/<locale>.md` (register, glossary, untranslated product names —
the th-TH brief is the template), translate `en-US` under it into
`src/messages/<locale>.ts`, then register the tag in both `GENERATED_LOCALES`
(`src/index.ts`) and `catalog-manifest.json`. The static `import()` map keeps
each locale its own lazy chunk, exactly as `players-shared`'s `catalogs.ts`
does.

## Promoting a locale to the reviewed set

A locale that has been through a review pass above can go further — into the
audited set `players-shared` itself ships — and hosts need no migration
either way:

1. A native speaker with domain context reviews the catalog — the
   calibration report's finding list is the review checklist.
2. Move the corrected catalog into
   `packages/players-shared/src/i18n/messages/<locale>.ts`, add the tag to
   `BundledLocaleCode`, `catalogs.ts` and `COMPLETE_LOCALES` per that
   package's README, and give it a changeset.
3. Delete the catalog from this package and the tag from the loader map and
   manifest.

Because hosts compose the loaders bundled-first, the reviewed catalog wins
from the moment it ships, whether or not the host has removed this package.
