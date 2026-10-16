# Dutch (nl-NL) calibration brief

The instructions the **calibration run** is generated against. This locale is
not shipped from this package — `nl-NL` already ships reviewed from
`players-shared`. The calibration catalog exists to measure the pipeline
against a native-speaker-audited catalog of the same inventory, and to teach
future briefs what machine translation misses. See
`calibration/nl-NL-calibration.md`.

## Register

- The impersonal infinitive for interface strings (`Sluiten`, `Opslaan`,
  `Opnieuw proberen`), never the imperative — the convention in Dutch UI, and
  it avoids choosing between `u` and `je`.
- Whole sentences authored as sentences; no assembled fragments.

## Terminology

| English | Dutch | Note |
| --- | --- | --- |
| question (a delivered question) | vraag | |
| passage | tekst | a reading passage |
| read aloud | voorlezen | the accommodation |
| submit | inleveren | assessment register, not `verzenden` |
| finish | afronden | |
| tool | hulpmiddel | assessment tools are aids, not instruments |
| settings | instellingen | |
| try / tries left | poging / pogingen over | |
| section | sectie | assessment section |
| item | item | left as the loanword, as Dutch assessment software does |

## Untranslated product names

Polly, Google Cloud TTS, WaveNet, Desmos, PIE, SSML, PNP, AWS.

## Plurals, numbers

- Dutch CLDR categories: `one` (`geslacht`-neuter singular), `other`. Keep the
  categories English's groups carry; `other` is required.
- Arabic numerals.
