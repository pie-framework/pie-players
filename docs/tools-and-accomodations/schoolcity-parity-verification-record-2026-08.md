# SchoolCity Parity Verification Record, August 2026

Companion to [`schoolcity-tool-parity-report.md`](./schoolcity-tool-parity-report.md), which was written 2026-06-26 and corrected in place on 2026-08-15. The parity verdicts live in that report. This file records what was checked, against which source, and what could not be established — so a later reader can tell a verified claim from a documented one without re-running the pass.

## Sources Consulted

| Source | Role | Standing |
| --- | --- | --- |
| `pie-players` @ `fc71c915` (branch `feat/formative-delivery`) | PIE player and toolkit state | First-party source |
| `pie-elements-ng` | Element models, delivery, authoring | First-party source |
| `/Users/eelco.hillenius/dev/prj/math-validation` | Math equivalence implementation and its README | First-party source |
| `sc-online-testing` | Current SchoolCity student delivery (Nuxt 3) | First-party source |
| `sc-suite-student` | Legacy SchoolCity student delivery (ASP.NET MVC) | First-party source |
| `sc-suite-staff` | SchoolCity admin configuration, staff preview delivery | First-party source |
| `sc-texttospeech-api`, `-terraform`, `-automation` | SchoolCity TTS service, its provisioning, its CI | First-party source |
| `help.learnosity.com`, `authorguide.learnosity.com`, `learnosity.com` | Learnosity capabilities | First-party documentation, not source |
| `support.renaissance.com` articles already cited in the report | SchoolCity documented student-facing behavior | First-party documentation, not source |
| SharePoint master gap-analysis DOCX | Original basis of the report's SchoolCity rows | **Not opened** — inaccessible in this environment |

Jira was not accessed for the August pass. All `PIE-###` keys in both documents were carried as text from the report itself or from in-repo PRDs.

Amended 2026-08-16: PIE-472, PIE-478 and PIE-479 were read directly, and one of them contradicted the report. PIE-472 is not simply open — it was deferred out of the SB v1 scope, its owner asked for it to move to PD-5359 as out of launch scope, and the question of which alternate colour schemes matter, and for which learners, went to a stakeholder and never came back. The report's cross-reference table read as a live gap awaiting implementation. The other two carry no acceptance criteria and no constraint the report missed, and all three sit under PIE-500 with the same assignee. Every other `PIE-###` key in these two documents is still carried as text and unverified.

## Verified In Code Versus Documented

**Verified in code** — a file and line was read, and the claim restates what the code does. Everything in the report attributed to a `path:line` citation is in this class, including: the eleven-capability toolbar registry; the `audioTranscript` and `signLanguage` region capabilities and the three host surfaces; the ten built-in color schemes and custom-scheme registration; per-provider TTS speech-mark behavior; the formative Try/reveal/mastery contract and its student-facing control; `charactersLimit={50000}`; the absence of any `hint` field; print subpath coverage and the print player's miss behavior; `BUILT_IN_VIEWS`; the absence of `MediaRecorder`/`getUserMedia`; element-level i18n coverage in `@pie-lib/translator`; and every SchoolCity mechanism cited to an `sc-*` path.

**Documented but not verified in code** — the entire Learnosity column. No Learnosity source was read; every Learnosity claim rests on its public documentation, and the report says so in the Learnosity section. The Renaissance support articles are likewise documentation: where they disagree with `sc-*` source, the report follows the source and names the disagreement.

**Inferred, and labelled as such in this record only** — AWS Polly's speech-mark offsets are byte offsets rather than character offsets, which matters for non-ASCII languages in the SchoolCity voice map. That is Polly's documented contract, not something visible in either repository, and it is not asserted in the report.

## Hypotheses Refuted Or Materially Corrected

The pass was given nine prior findings to confirm rather than rediscover. Two were refuted outright and four needed correction.

**Refuted — element-level i18n is absent in `pie-elements-ng`.** It exists. `@pie-lib/translator` (`pie-elements-ng/packages/lib-react/translator/src/index.ts:11-23`) is an i18next instance with en + es bundles, locale normalization and plural suffixes, wired into 10 of 30 element packages and 5 delivery libs, in delivery code and not only authoring. The corrected claim is that coverage is partial and inconsistent: no Svelte element uses it, and files that translate one string hardcode others (`math-inline/src/controller/index.ts:237` calls `translator.t(...)`; lines 383-405 hardcode `'This field is required.'`). The report's translation section states it this way.

**Refuted — a paper form containing a print-less element "cannot render".** It renders. The print player HEAD-checks for the module and substitutes a placeholder element reading "Print module is not configured for this item type" (`packages/print-player/src/element-resolver.ts:88-94`), so the form degrades element by element and the remaining items print normally. The 12-of-30 count itself was confirmed exactly. A related subtlety: a `fallback: "delivery"` for the print view *is* defined (`packages/players-shared/src/loaders/esm-adapter.ts:41`) and *is* implemented in the generic loader, but the print player supplies its own view config without it and the HEAD pre-check short-circuits first, so it is unreachable from the print path.

**Refuted — Learnosity ships audio *and video* play-count limits and seek restriction.** Only audio has a limit. The `audioplayer` feature carries `playback_limit`; the [`videoplayer` feature](https://help.learnosity.com/hc/en-us/articles/16685252751005-Video-player) documents no play-count and no seek restriction, checked against both the reference and author-guide pages. Neither product restricts seeking. This makes PIE's timed-media gap smaller than assumed.

**Corrected — "27 React + 3 Svelte, effectively legacy parity".** The count is exact, the parity claim is a coincidence. The two rosters overlap on 27; legacy `pie-elements` additionally has `calculator`, `protractor` and `ruler` element packages, and `pie-elements-ng` has three *new* Svelte elements rather than ports. The tool-shaped elements did correctly move to `pie-players`, though ruler and protractor React implementations survive vestigially in `pie-elements-ng/packages/lib-react/tools/src/index.ts`.

**Corrected — Learnosity's math rule set.** Six current methods, not the ten expected: `equivLiteral`, `equivSymbolic`, `equivValue`, `stringMatch`, `equivSyntax`, `isTrue`. `equivSyntax` was not in the hypothesis; `isSimplified`, `isFactorised` and `isExpanded` are now filed under legacy in the author guide, which does not say whether they still function. **Sympy backing could not be sourced** on any Learnosity domain and is not asserted in the report. Chemistry validation is **not** chemistry-aware: the four chemistry question types reuse the same six general rules over LaTeX, defaulting to `equivLiteral`.

**Corrected — `docs/architecture/architecture.md` "advertises" `delivery-mobile` and `delivery-a11y`.** It lists them under "Custom views (enabled by package.json subpath exports)" at lines 108-112, so it presents them as what the mechanism permits rather than as shipped artifacts; built-in views are only `delivery`, `author`, `print`. `pie-elements-ng/docs/ARCHITECTURE.md:148-164` is the stronger overclaim, diagramming all five as peer folders of `multiple-choice`, which has one delivery view. Both repositories also carry demo-app tooling that labels and tests for view names no package produces.

**Corrected — "no mhchem / chemistry-aware validation".** True for validation. But `pie-elements-ng/packages/shared/math-rendering-mathjax/src/adapter.ts:91` enables MathJax's `autoload` package, whose defaults map `mhchem` to `\ce` and `\pu`, and MathJax is fetched from CDN at runtime. `\ce{...}` may therefore trigger an on-demand mhchem load. Never enabled deliberately, never tested; **not verifiable** from the repositories, since MathJax is not vendored and the local checkout is v3 while the runtime pins v4. The report claims only the absence of chemistry response and scoring.

**Confirmed as stated** — no `MediaRecorder`/`getUserMedia` and no upload response in either repository (the three `<input type="file">` occurrences are all authoring-side); `math-inline` equivalence limited to `symbolic` + `literal`; `realization.seed` documented as future QTI shuffle/selection and unimplemented (`packages/assessment-toolkit/src/attempt/TestSession.ts:16`); no time modeling anywhere in the assessment toolkit; timed media design-only with one open renderer-dispatch decision, which the architecture note itself records as revalidated 2026-08-15; both item-level gaps (author-configurable character limit, distinct student-facing hint).

One qualification on the math-validation README: it is self-contradictory and stale. Line 45 admits literal options are not set up, while lines 90-93 document `allowTrailingZeros` and `ignoreOrder` and `src/literal/index.ts:23,28` implements both. README mtime is March 2024 against October 2025 source. Line 45 is quotable as a documented admission, not as current implementation state.

## Could Not Be Verified

- **The canonical SchoolCity tool list.** It is a database table — `OnlineTool` (`sc-suite-staff/java/com/schoolcity/stars/entity/online/OnlineTool.java:13-54`) — and there are no `.sql` seeds in any of the three repositories. The clients special-case a subset of `ToolName` strings and render the rest as generic checkboxes keyed on `Handle`. Six `OnlineToolID` values are pinned by hardcoded staff references (13 Answer Eliminator, 19 Text to Speech, 30 Full Assessment Translation, 31 Writing Checklist, 39 Speech to Text, 230 Disregard Item Level Settings), and a commented-out registry literal in `sc-suite-student` exposes eight more ID/name/handle triples. Establishing the authoritative list requires querying that table. This is why the master document cannot be fully validated, and why the Browser Zoom row is reported as a probable documentation artifact rather than simply deleted.
- **The dictionary content vendor.** SchoolCity's English and Spanish dictionaries resolve to `dictionary.schoolcity.com`; no third-party vendor is named anywhere in the three repositories, so what is licensed behind that host is unknown.
- **The Translate Selection vendor.** The selected-text path calls `appSettings.TranslationURL`, a district-level setting, so the service behind it is not determinable from client code. Full-assessment translation is separately and definitely the public Google Translate widget.
- **Whether PIE reaches the SchoolCity TTS service in production.** The service authorizes by JWT issuer; `main` and `stage` know only `sc`, `dna`, `archivists`, while `pie-api` and `knowledge-check` exist on the `dev` branch and their Terraform secrets only on an unmerged branch. The in-repo consumer is the section-demos route. Deployment reality is outside these repositories.
- **Whether Learnosity's legacy math rules still function.** The author guide moved `isSimplified`, `isFactorised` and `isExpanded` into a Legacy category without stating removal.
- **Learnosity's `learnosity-i18n` label bundles.** The 17-locale list is the on-domain claim; the bundles themselves live in a GitHub repository the consumer must host, which was not inspected. Learnosity's own documentation states many are machine-translated and that bundles lag new features.
- **The Desmos calculator roster in Learnosity.** The partner directory lists Graphing, Scientific and Four Function; the demos page also lists Matrix. Not reconciled.
- **The SharePoint master DOCX.** Not opened, per the brief. Every SchoolCity row in the report still carries its `Master DOCX` provenance; this pass adds source verification beside it rather than replacing it.

## Provenance Note On Two Report Rows

Two Speech-to-Text edits in `schoolcity-tool-parity-report.md` — the PIE-500 cross-reference note and the assessment-level row, both pointing at [`../prds/speech-to-text.md`](../prds/speech-to-text.md) — were introduced by a subagent during this pass rather than by the reviewing agent. They were kept after independent verification against that PRD, whose lines 51-55 state the platform-dictation position the rows summarize and whose status is Draft. Recorded because an unattributed edit to a canonical document should not pass silently.

## Material Landed Between 2026-06-26 And 2026-08-15

243 non-merge commits. The ones that changed a parity verdict, by short SHA:

| SHA | Change | Verdict affected |
| --- | --- | --- |
| `fc71c915` | Formative delivery: Try state, feedback reveal, section mastery | New check-answer section; new Learnosity row |
| `a5241b9a`, `3f6e33ae` | Sign-language catalog rendering, then extraction into `@pie-players/pie-tool-sign-language` | Tool surface; exceeds both comparators |
| `60af674d` | Audio-transcript visibility resolved as a capability | Tool surface |
| `61d6aa0c` | Accessibility catalogs resolved for print (PIE-904) | Print coverage |
| `25511d75` | Recorded audio as a `spoken` alternate | TTS; PIE-480 |
| `82edb28f` | `data-tts-suppress` honoured | TTS |
| `b960bae5`, `513f3975` | Line reader window view, frame masking as host setting (PIE-811) | Line reader; PIE-487 |
| `c16c77c0` | Answer-choice strikethrough for images and math (PIE-840, PIE-841) | Answer eliminator |
| `1f29de7f`, `a4beb700` | Unified theme resolution and colour schemes; published token registry (PIE-901) | Color contrast; PIE-472, PIE-484 |
| `c59396b2`, `51836543` | Capabilities render into host surfaces; capabilities declare authored-content dependencies | Tool surface architecture |
| `411b2cd8` | Default PNP profile becomes configuration, not a derivation (breaking) | PIE-485, PIE-486 |
| `9d3c5005` | DaisyUI bridge package removed; the mapping survives as an internal provider adapter | Theme section |

## Incidental Findings Not Carried Into The Report

Out of scope for a parity report, recorded once here.

- `sc-texttospeech-api/src/api/polly.js:254-280` — a cache miss for a new language/voice/rate combination rebuilds the DynamoDB item from scratch and overwrites it, discarding every previously cached combination for that text. Multi-language use thrashes the cache.
- `sc-texttospeech-api/src/api/polly.js:549-570` — `validateSSML` tests for a `parsererror` element, which is browser `DOMParser` behavior; `xmldom` never produces one, so the validator always returns valid and malformed SSML reaches Polly.
- `sc-texttospeech-api/src/api/polly.js:11` — `const REGION = process.env.REGION && "us-west-2"` hardcodes the region whenever `REGION` is set.
- `sc-texttospeech-api` returns HTTP 200 for every error; all `reply.code(400)` calls are commented out.
- `sc-online-testing/plugins/ckeditor5/audio-recorder/audio-recorder-plugin.ts` is never imported, and `config/ckeditor.ts:380` adds an `audioRecorder` toolbar button for one tenant with no capture path behind it.
- `sc-suite-student` defines `answerEliminator()` twice with different arities, and `createTextHighlighter()` twice — a live hazard if both bundles load. A `'Protactor'` misspelling in a hide-list makes that hide a silent no-op.
- `pie-elements-ng/packages/lib-react/translator/src/index.ts:18` hardcodes `debug: true` in the i18next init.
- `pie-elements-ng/packages/elements-react/math-templated/src/author/design.tsx:179` defaults new responses to `'symbolic'` while `author/defaults.ts:28` sets `validationDefault: 'literal'`.
- `packages/theme/src/font-sizes.css` is published as `./font-sizes.css` but imported nowhere in the repository. **Understated — corrected 2026-08-16.** Being unimported was the least of it: every rule targeted `pie-player`, the externally loaded item wrapper, so a host that did import it scaled nothing this repo renders; and `font-size: inherit !important` on `*` flattened every heading in an item to body size at 100% scale. Neither defect reached a consumer, established later against the checkouts: the rules are all scoped under a `data-font-size` attribute that no recorded host sets. `ThemeProvider` writes the same token from its own `FontSize` setting and is constructed nowhere, with nothing carrying the `.pie-themed` class its rules need. Reading a stylesheet for what it declares, rather than against the elements the repo defines, is what let this pass as scaffolding.
- Five of the eight named accessibility catalog types — `braille`, `tactile`, `simplified-language`, `audio-description`, `extended-description` — have no renderer. Only `spoken`, `sign-language` and `transcript` have consumers.
