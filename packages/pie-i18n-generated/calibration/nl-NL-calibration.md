# nl-NL calibration: machine generation measured against the audited catalog

One run of the generation pipeline — `en-US` plus `briefs/nl-NL.md` into
`nl-NL.generated.ts` — diffed key by key against the native-speaker-audited
`players-shared/src/i18n/messages/nl-NL.ts`. The point is to measure what the
pipeline does and does not deliver, and to turn the misses into brief and
review guidance for the locales that have no audited ground truth.

## Method and honesty notes

- Same inventory, same mechanics: both catalogs flatten to identical key sets
  (462 leaves, plural groups as single leaves) with **zero key-parity issues
  and zero placeholder mismatches**. The comparison is like-for-like.
- **Not blind.** The generated run was produced by the same model family that
  ships the generated tier, and the audited catalog's header and `common`
  verbs had been seen beforehand. Those strings are exactly where any Dutch UI
  converges regardless, so the overlap costs the measurement little — but it
  is stated rather than hidden.
- The audited catalog is the bar because a Dutch native speaker with
  assessment-domain context read every string against what Dutch assessment
  software actually shows learners. That is the thing machine generation
  cannot supply.

## Headline numbers

| Measure | Result |
| --- | --- |
| Keys compared | 462 |
| Key/placeholder structural integrity | 0 issues |
| Byte-identical with the audited catalog | 216 (47%) |
| Differing | 246 (53%) |

Roughly half the inventory converges without help: the standard UI verbs
(`Sluiten`, `Annuleren`, `Opslaan`, `Vorige`, `Volgende`), every product name,
all six signed-language names, most tool names (`Rekenmachine`, `Grafiek`,
`Periodiek systeem`, `Vergrootglas`, `Thema`), and most of the TTS settings
vocabulary. Where the brief pinned a term the audited catalog also chose
(`vraag`, `tekst`, `voorlezen`, `inleveren`, `afronden`), the run matched.
The divergence is concentrated, predictable, and categorized below.

## Finding 1 — domain register is the biggest miss

Where Dutch assessment and math-education practice has a specific word, the
run reached for the generic word or a loanword. Every one of these renders
"translated" to a Dutch teacher:

| Key | Generated | Audited | Why the audited one is right |
| --- | --- | --- | --- |
| `player.section` | Sectie | **Onderdeel** | Dutch tests have onderdelen, not secties |
| `player.items` | Items | **Vragen** | Dutch software shows vragen; "item" is psychometric jargon |
| `tools.protractor.name` | Gradenboog | **Geodriehoek** | the school geometry instrument's actual name |
| `tools.ruler.name` | Liniaal | **Lineaal** | the drawing instrument, not the workshop ruler |
| `tools.graph.description` | Coördinatenvlak | **Assenstelsel** | the word math education uses |
| `tools.ruler.inches` | Duim | **Inches** | the unit as tests present it, not the folk unit |
| `tools.answerEliminator.name` | Doorkrassen | **Wegstrepen** | the strike-through action of the exam room |
| `debug.pnp.noAssessmentBoundBody` | testadministratiebeleid, accommodatie | **afnamebeleid, voorziening** | the education sector's words for both |
| `debug.pnp.provider` | Provider | **Aanbieder** | naturalized where the audience is broader |

One string carried both errors at once. This class is the reason a native
reviewer with domain context is not optional: no terminology brief written
without a domain reader fixes it, because the brief itself got `sectie` wrong.

## Finding 2 — calques where Dutch has its own phrase

The run translated *resize* literally everywhere ("van grootte wijzigen");
the audited catalog says what Dutch UI says ("Panelen verkleinen of
vergroten", "verstellen"). Loading states came out as labels ("Sectie-inhoud
laden…") where the audited catalog uses the descriptive form ("Onderdeel
wordt geladen…"). Rotation came out "met de klok mee roteren" where Dutch says
`rechtsom`/`linksom`. The audited catalog also establishes one compact
adjective formula per tool role — "Verplaatsbare en draaibare lineaal",
"Verplaatsbare en verstelbare leesvenster" — where the run improvised a new
participle construction per tool. And it drops redundancy the English forces:
"Calculator tool" is just `Rekenmachine`, "Graph point {id}" is just
`Punt {id}`, the graph canvas is `Tekenvlak`. A brief can pin these *patterns*
once the first audited locale has established them.

## Finding 3 — context the key name cannot carry

- `common.author` → generated `Auteur` (a person); audited **`Bewerken`**
  (the authoring mode — the key sits next to "Preview" as a mode pair).
- `common.enabled`/`disabled` → generated `Ingeschakeld`/`Uitgeschakeld`;
  audited **`Aan`/`Uit`** — these render as toggle states, not descriptions.
- `toolkit.toolbarInitError` → kept the English product term
  ("assessment-toolkit") and the jargon `initialiseren` in a learner-facing
  error; audited: "De hulpmiddelen konden niet worden gestart."
- `debug.tts.title` → `TTS-instellingen`; audited **`Voorleesinstellingen`**
  — even the settings panel speaks learner language, reserving the acronym
  for genuinely technical strings.
- `tools.ruler.applicationA11y` → the English source's comment explains its
  units are spelled out because a screen reader reads "cm" as two letters.
  The run translated the string but not the intention; the audited catalog
  spells out for the same reason. Comments are not comments to a generator.

## Finding 4 — grammar and agreement errors

Low in count but the most disqualifying class, because these mark text as
machine-made instantly:

- `signLanguage.description` → generated **"Gebarende-alternatief"** — broken
  morphology, not a Dutch word.
- `periodicTable.outsideFilterA11y` → ", buiten **de** huidige filter" —
  wrong article gender (`filter` is a het-word; the audited catalog has it
  right).
- `periodicTable.elementA11y` → capitalized field labels (`Symbool:`)
  where Dutch sentence-internal labels stay lowercase (`symbool:`).

## Finding 5 — the register rule was too blunt

The brief (and the audited header) says the impersonal infinitive avoids
choosing between `u` and `je` — and for *labels* that holds. But the audited
catalog freely uses **je** where prose needs a subject: "Je opgeslagen
antwoorden … konden niet worden hersteld", "voordat je verder gaat". The
generated run, obeying the ban literally, produced stiffer impersonal prose
("De opgeslagen antwoorden … konden niet worden hersteld"). Correct reading of
the audited register: **infinitives for controls, je for sentences**. A
register policy has to be stated per string class, not globally.

## What carries over to th-TH and beyond

The Thai brief already encodes the classes that transfer: a pinned glossary
(`ตอน`, `ข้อสอบ`, `บทอ่าน`), a per-class register rule (neutral-formal, no
polite particles — the Thai analogue of the infinitive rule, and the same
bluntness risk), spelled-out units for screen readers, and untranslated
product names. What this calibration adds to every future brief and review
pass:

1. **The glossary must come from the domain, not from the translator** —
   before or during review, not after.
2. **Review focuses on the five classes above**, in that order: domain
   register first (the most frequent and most visible), calques, context,
   grammar, register-of-address.
3. **Grammar slips are rare but disqualifying** — a native pass exists
   precisely to catch the two or three a run produces.
4. Structural integrity (keys, placeholders, plural shape) is a solved
   problem: zero issues across 462 keys here and 100% coverage on th-TH.
   Review effort should go entirely to the language, never to the mechanics.

## Verdict

The pipeline delivers structure for free and roughly half the language for
free; the other half needs a native reviewer with domain context, concentrated
on enumerable error classes. That matches the design intent: generated
catalogs are honest, freshness-gated drafts whose review can be scoped and
whose promotion into the reviewed set is a copy, not a rewrite.
