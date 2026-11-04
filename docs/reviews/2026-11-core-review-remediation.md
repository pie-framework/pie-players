# Core review 2026-11 — remediation tracker

Self-contained tracker for the remediation of the November 2026 core review
(read-only design/duplication/dead-code review of every non-demo package,
`tools/cli`, `apps/local-esm-cdn`, `apps/docs` and repo infrastructure; 12
scoped review passes, findings caller-verified, headline P1s re-verified by
hand). Chat history is not durable; this file is the only source of truth for
the finding references.

Tracking convention:

- **Item ids** `R-01`…`R-26`; **decision ids** `D1`…`D8`.
- Branches: `<type>/r<nn>-<slug>` using the repo's existing types (`feat`,
  `fix`, `chore`, `refactor`, `docs`, `test`).
- PR titles cite the ids: `fix(tools): … (R-01)`; changeset descriptions cite
  them too. The R-id takes the slot a `PIE-####` ticket key would otherwise
  occupy. Consumer-pad trailers keep their existing checked format.
- One item = one PR = one patch changeset unless the row says otherwise.
- Status updates are documentation-only edits to this file and commit straight
  to `develop` (no PR, no gate beyond `check:docs`).

Statuses: `todo` · `in progress (<branch>)` · `done (<PR>)` · `won't do
(<rationale>)`.

---

## Findings appendix

### P1

- **R-01 — Answer-eliminator `mask` strategy hides the undo control from
  assistive technology.**
  `packages/tool-answer-eliminator/strategies/mask-strategy.ts:114-120` sets
  `aria-hidden="true"` on the choice container — the same container the toggle
  button is appended to (`answer-eliminator-core.ts:290`), and the button stays
  visible for eliminated choices (`:545-549`). Screen-reader users cannot
  discover or operate undo; focus lands inside an `aria-hidden` subtree (WCAG
  4.1.2). The strikethrough strategy does this correctly; `setChrome`
  (`answer-eliminator-core.ts:140-145`) silently no-ops for mask, which has no
  `EliminationChrome` support.

- **R-02 — Published light-DOM elements depend on host DaisyUI/Tailwind
  classes.**
  `packages/section-player-tools-tts-settings/TtsSettingsPanel.svelte` (13+
  `btn/select/input/toggle/alert/fieldset` + utilities), 
  `packages/section-player-tools-shared/DebugPanelToggles.svelte:35-81`. These
  are `shadow: "none"` elements whose README promises registration-only
  integration; no PIE stylesheet defines the classes, so non-DaisyUI hosts get
  unstyled controls and a broken focus-trap dialog. Violates the AGENTS.md rule
  that light-DOM elements "depend on no host or global utility class names".
  Host R (consumer pad) side-effect-imports all five section-player-tools
  packages.

- **R-03 — FontAwesome/NDS glyph machinery: two copies and one orphan.**
  The FA head-install + shadow-mirror machinery — version pin
  `fontawesome-free@6.5.2` and host-FA detection regex included — is
  near-verbatim in `tool-tts-inline.svelte:85-244` and
  `assessment-toolkit/src/components/ItemToolBar.svelte:132-261`, already
  diverging (Pro-aware vs hardcoded `fa-solid`). `section-player/src/components/shared/SectionItemsPane.svelte:762`
  renders `<nds-icon-button>` (scroll hint) with no FA install into its shadow
  root, so under `ndsIcons: true` the glyph can render blank.

- **R-04 — Publish-surface validation exists twice, wired into different
  gates, already drifted.**
  `scripts/check-publish-surface.mjs` (pre-commit via `check:source-exports`)
  and `scripts/check-pack-integrity.mjs` (CI, `verify:publish`) share ~10
  verbatim helpers; pack-integrity gained `isBuildConfigDeclaration`
  (`:37`, pinning a real regression) which publish-surface lacks, so a package
  can pass the hook and fail CI. Also dead: four superseded root scripts
  (`check:pack-smoke`, `check:pack-exports`, `check:runtime-compat`,
  `check:sourcemaps`, ~550 lines, subsets of pack-integrity) and
  `scripts/smoke-pie-elements-ng-esm.mjs` + engine (~950 lines, zero callers).

### P2

- **R-05 — Overlay-tool lifecycle wiring ×4, already diverged.**
  Protractor/ruler carry ~45 verbatim lines each
  (`tool-protractor.svelte:92-140`, `tool-ruler.svelte:84-163`);
  magnifier/line-reader re-wire the same primitives by hand and diverge on
  Escape-close semantics (`tool-magnifier.svelte:135-144,482-539`,
  `tool-line-reader.svelte:131-140,480-531`). Announce-timer helper is copied
  four times (incl. ruler/protractor). The shared placement engine
  (`players-shared/src/ui/overlay-placement.ts`) already exists; the Svelte-side
  wiring does not.

- **R-06 — Composed-ancestor walk and unmount contract key mirrored.**
  `[data-pie-tool-overlay-boundary]` walk: `ItemToolBar.svelte:1269-1286` vs
  `tool-tts-inline.svelte:894-906`. `__pieToolElementUnmount` constant:
  writer `default-tool-loaders/src/registrations/overlay-element-cache.ts:22`
  vs mirrored reader literal `ItemToolBar.svelte:1288`, no pinning check.

- **R-07 — `$effect` mutates reactive state in a tracked body (toolkit).**
  `ItemToolBar.svelte:1125-1131` calls `syncRenderedToolsState()`
  synchronously in the tracked body, writing `activeToolState` and invoking
  every rendered tool's `sync()`; the three sibling handlers for the identical
  write (`:1146`, `:1220`, `:1244`) defer through `queueMicrotask` with
  documented reasons.

- **R-08 — ItemToolBar embeds a ~1230-line floating-window manager.**
  `ItemToolBar.svelte:1358-2590` (`mountElementWithShell`): drag/resize
  gesture math, keyboard move/resize, focus trap + page-Tab bridge, localized
  header/controls built via ~200 inline style assignments. Also in the same
  file: local `getDeepActiveElement` (`:1822-1834`) duplicating players-shared's
  private focus-trap helper, and floating shells that trap focus without
  `role="dialog"`/accessible name (`:2105-2149`). The headless-module seam for
  exactly this class of machinery already exists: `tools/tool-surface-host.ts`.

- **R-09 — Composition revision logic lives in the CE.**
  `PieAssessmentToolkit.svelte:695-825` (`hashString`,
  `toRenderableSnapshots`, `toSessionSnapshots`, `toFormativeSignature`,
  `toCompositionSnapshot`, `getCompositionRevisionKey`) encodes the section
  controller's model shape inside the element; the natural owners are
  `runtime/composition-revision.ts` (beside the emit scheduler) or
  `SectionControllerBinding`.

- **R-10 — TTS: wire protocol ×2, mark parser ×3, bucket type ×2, orphan
  cache.**
  SC/custom-transport protocol hand-written in `tts-server-sc` and
  `tts-client-server`, already diverged (`langId` dual-send vs `lang_id`-only;
  inline `speechMarks` accepted by one side only). Speech-mark parsing three
  times with different robustness/type policies; Polly (the format's origin)
  hand-rolls its own and fails whole syntheses on one malformed line
  (`PollyServerProvider.ts:369-393` vs `tts-server-core/speech-marks.ts:30-52`;
  `ServerTTSProvider.ts:464-496`). `SpeedRateBucket` declared in both
  `packages/tts/provider-interface.ts:99` and `tts-server-core/speed-rate.ts:6`.
  `tts-server-core/cache.ts` has no integration point — no provider accepts an
  `ITTSCache`; nothing consumes it. Also Google/Polly expose no request timeout
  while SC bounds every upstream fetch.

- **R-11 — Calculator adapter scaffolding triplicated.**
  Instance registry + cascade-destroy loop
  (`desmos-provider.ts:98,263-270`, `geogebra-provider.ts:127,235-242`,
  `cortex-provider.ts:22,91-98`), `emitTelemetry` (×2 identical + 2 variants),
  library-load telemetry trio with duplicated payload keys and the
  `ToolLibraryLoadError` literal in three files. The leak-fix invariant exists
  only as three re-implementations. Related: cortex engine tuning duplicated
  (`calculator-controller.ts:102-107` vs `evaluation-engine.ts:21-27`); worker
  fabricates a `ResolvedCortexSettings` to satisfy `validateExpression`.

- **R-12 — Interface-locale provider wiring ×3 beside an existing helper.**
  `useInterfaceI18n` (players-shared) exists for exactly this wiring;
  item-player (`PieItemPlayer.svelte:942-1003`), its debugger copy
  (`ItemSessionDebugger.svelte:96-136`, which swallows load failures the player
  reports to hosts), and the toolkit all hand-roll it.

- **R-13 — Capability knowledge accreting outside the neutrality gate.**
  `ToolkitCoordinator.ts:156-170` (`textToSpeech` deep-merge special case),
  `:783-791` (hard-coded enabled defaults), `tools-config-normalizer.ts` and
  `tool-icons.ts` — none in `check-capability-neutrality`'s scan list, so the
  PIE-886 regression class recurs ungated.

- **R-14 — Tool-icon registry drift.**
  `highlighter`/`strikethrough` missing from `TOOL_FALLBACK_ICONS`
  (`assessment-toolkit/src/services/tool-icons.ts:18-41`) despite the file's
  own same-change rule; the annotation toolbar renders a blank icon-only glyph
  (no `.icon-*` CSS exists) and the answer eliminator compensates with inline
  SVG (`interaction-tools.ts:250`), the one registration bypassing the
  mechanism.

- **R-15 — tts-settings published declarations drag the toolkit in.**
  `element-props.ts:1` imports `ToolkitCoordinatorApi`; it lands in the built
  `.d.ts` while the toolkit is a `devDependency` — breaks consumer typechecking
  without `skipLibCheck`. Siblings define local structural types precisely to
  avoid this. Also: toolkit dep inconsistent across the five packages
  (`dependencies` in session/pnp, `devDependencies` elsewhere).

- **R-16 — assessment-player defects.**
  `sameContent` re-implementation lost cycle safety
  (`AssessmentPlayerDefaultElement.ts:69-84` vs the cycle-safe
  `item-list/src/components/same-content.ts:6-37`) — a host assigning a cyclic
  session object stack-overflows the page. Committed `custom-elements.json`
  misdescribes two events (doc-comment inserted mid-`@fires`,
  `AssessmentPlayerDefaultElement.ts:107-110`). `AssessmentReadinessChangeDetail`
  published for an event that does not exist (`contracts/public-events.ts:47-49`).
  Four `as any` casts bypass the published section-player element types
  (`:1054-1057`). Three navigation methods are copies of one ~35-line block
  (`:1179-1249`). Host contract re-introduces the retired selector trio
  (`contracts/runtime-host-contract.ts:27-29`) beside the building blocks'
  `getSnapshot()`.

- **R-17 — section-player dead surface + duplication.**
  Five dead public `SectionController` methods (`:388,413,417,1258,1264`);
  telemetry `$effect` bridge pasted into all four layout elements (event map,
  dedupe window, opt-out semantics ×4); `SectionItemCard`/`SectionPassageCard`
  duplicate card render-context wiring (~90 lines) and ~140 lines of identical
  light-DOM chrome CSS; `SessionChangedResult.itemSessions/.sessionState`
  computed every change and read by nobody (keeps `SectionSessionState` alive);
  card heading DOM ids unique only per player instance; `SectionSplitDivider`
  on mouse events while the card divider already uses pointer events.

- **R-18 — item-player defects.**
  Two `<pie-player>`-era behaviors (`publishSessionToHostProp`
  `:1547-1565`, `seedHostSessionEntriesForItem` `:1567-1586`) lack the required
  `pie-item contract compatibility:` marker and covering tests (the third shim
  in the same file, `:645`, has one). `showBottomBorder` effect
  (`:1509-1527`): inline styles with no cleanup, raw `env.mode` read bypassing
  `parseEnvValue`, borders lost on authoring-key remount. Error-banner
  markup/CSS ×3 with "kept in step" comments, already microscopically drifted
  (`margin: 20px` vs `margin: 20px 0`).

- **R-19 — Exact-tag rewrite regex ×3.**
  `players-shared/src/pie/authoring-tag.ts:1-23`,
  `pie/config.ts:263-278` (`makeUniqueTags`), `pie/overrides.ts:86-100`.

- **R-21 — AccessibilityCatalogResolver keeps a production-dead second store.**
  `itemCatalogs`/`addItemCatalogs`/`clearItemCatalogs`
  (`AccessibilityCatalogResolver.ts:304-305,553-566`) have no production
  callers and no compat comment; `getAllAlternatives`' enumeration precedence
  no longer matches `getAlternative`'s scoped-owner precedence
  (`:597-625`) — a live resolution/enumeration disagreement for dual-authored
  ids.

- **R-22 — Dead published surface (pad-governed batch).**
  `hashCode` (print-player root entry), `modelsForPackage` +
  `safeLocalStorageGet/Set` (players-shared), `loadPieModule` trio +
  `applyElementOverrides` + three URL helpers (players-shared, production-dead
  second loader paths), toolkit `changeAnnotationColor`,
  `getProvidersByCategory`, test-only `ToolRegistry` members, the
  `ToolSingletonScope` sub-contract with no runtime reader, sign-language's ~11
  consumer-less exports incl. the warning-less second resolver, theme registry
  trio (`getPieThemeProvider`/`unregisterPieThemeProvider`/normalizers),
  `SectionChangedResult` narrowing + `SectionSessionState`,
  `math-rendering-ready` wrapper over an already-memoized function. Internal
  dead code deletes directly in owning packages: answer-eliminator
  `resetAll`/`getEliminatedCount`/`disableStateRestoration` +
  strategy-interface methods, `ComponentDefinition`/`PlayerDefinitionMap`,
  `DEFAULT_NARROW_BREAKPOINT_PX` export, `loadingCard` binding.

### P3 (folded into waves, not tracked individually)

Announcement/aria/i18n tail (annotation toolbar hardcoded English ×5,
`SessionDbPanel` strings, periodic-table `role="grid"` without rows, magnifier
typing, card heading ids, split divider events); helper dedupe tail
(deep-clone ×4 beside `cloneDeep`, `errorMessage` ×2, `.pie-sr-only` ×7,
coordinator-subscription wiring ×2, clone/cap ×4 in debug panels, cortex
tuning ×2); infra tail (CLI duplicated build commands, npm auth YAML ×2,
`overrides`≡`resolutions`, CI dist artifact, local-esm-cdn leftovers,
svelte-check invocation drift across 28 packages, toolkit dep shape across the
five tools packages); desmos falsy-zero (`evaluate` returns the raw expression
for numeric `0`); lowercase-only version-suffix regex in `default-tool-loaders`;
assessment-player selector trio. These are absorbed into R-17/R-18/R-21-R-25
scopes rather than tracked one by one.

## Wave 0 — P1 defects

| ID | Title | Scope & fix | Gates / impact | Size | Status |
|---|---|---|---|---|---|
| R-01 | Answer-eliminator mask strategy: keep undo reachable | Wire `EliminationChrome`/`setChrome` for mask (announce like strikethrough) and scope `aria-hidden` to the content element, never the container hosting the toggle. Tests for both strategies' aria states. | bun tests; patch changeset; WCAG note | S | done (branch `fix/r01-eliminator-mask-aria-hidden`, c84fa59f, PR pending) |
| R-02 | Published light-DOM panels off host framework classes | Replace DaisyUI/Tailwind classes in `TtsSettingsPanel` + `DebugPanelToggles` with `pie-*` classes styled from component `<style>` on certified `--pie-*` tokens. Extend `tests/panel-theming.test.ts` (or add `check:ce-class-hooks`) to gate the class half. | Visual check in non-DaisyUI host; pad note for Host R; changeset | M | in progress — tts-settings half closed upstream (969b27ab, PR #920: `pie-tts-*` self-styled hooks, manifest updated); remaining: `DebugPanelToggles` + the class-hygiene gate |
| R-03 | FA/NDS glyph machinery: one owner, three consumers | New `players-shared` module beside the vendored NDS bundle owning pin + detection + shadow install; migrate `tool-tts-inline` + `ItemToolBar` (toolbar keeps Pro-aware layer); give `SectionItemsPane` the install. | api-report + pad + changeset (new export); extend fontawesome-assets spec; single-pin grep guard | M | todo |
| R-04 | Publish-surface validation: one implementation | Reduce `check-publish-surface.mjs` to a caller of pack-integrity's collectors (or retire `check:source-exports`); delete the four superseded scripts + root entries; update `docs/setup/publishing.md`, `docs/setup/library-packaging-strategy.md`. D1 decides the smoke tool. | scripts/tests; `check:scripts`; no changeset | S–M | todo |

## Wave 1 — Divergence-stoppers

| ID | Title | Scope & fix | Gates / impact | Size | Status |
|---|---|---|---|---|---|
| R-05 | Overlay-tool lifecycle: one wiring helper | Extract `createOverlayToolLifecycle` next to `createOverlayPlacement` (or beside `createToolCoordinatorRegistration`); migrate the four tools; D2 unifies Escape semantics; extract announce-timer helper. | Per-tool contract tests updated; api-report/pad/changeset; e2e tool suites | L | todo |
| R-06 | Composed-ancestor walk + unmount key: single homes | Export `findComposedAncestor` from players-shared/ui; move `__pieToolElementUnmount` to toolkit `tools/registration`; cache imports it; pinning test. | api-report/pad for new export; may ride R-05 | S | todo |
| R-07 | ItemToolBar `$effect`: no tracked-state writes | Defer `syncRenderedToolsState()` via the file's own `queueMicrotask` pattern (or `untrack`), matching `:1146/:1220/:1244`. | Existing tests | S | done (branch `fix/r07-itemtoolbar-effect-mutation`, a484e36c, PR pending) |
| R-08 | Extract the floating-window shell | Lift `mountElementWithShell` to a headless module beside `tool-surface-host` with `{update, destroy}`; `use:` action becomes an adapter. Include: `role="dialog"` + accessible name; reuse players-shared `getDeepActiveElement`. | e2e shell specs; new unit seam for geometry/focus; no public API change; pad check on host attributes | L | todo |
| R-09 | Composition revision logic out of the CE | Move the six functions to `runtime/composition-revision.ts` (or `SectionControllerBinding`); component keeps emit wiring. | runtime tests extended; after R-08 (same-file chain) | S–M | todo |
| R-10 | TTS: one wire protocol, one parser | Request–response wire types once in the `pie-tts` contract (per `8abe1b28`'s precedent; D3 reconciles `langId` dual-send vs `lang_id`-only and the client-only inline `speechMarks`); type-preserving JSONL parser, Polly adopts it (fixes the fail-whole-synthesis robustness gap), delete `parseInlineSpeechMarks`; D4 decides the cache hook; timeout parity for Google/Polly. Bucket type and word-timing format already single-sourced upstream. | TTS suites; contract surface grows → api-report/pad/changeset | M | in progress — bucket type + word-timing format closed upstream (`8abe1b28`/`ee1018da`); remainder above |
| R-11 | Calculator adapters: shared lifecycle/telemetry | D5 picks tiny `calculator-shared` runtime package (recommended) vs parity tests; migrate the four sites; joins Changesets fixed block in the same change if the package is created. | new package → fixed block + api-report + pad | M | todo |
| R-12 | Interface-i18n wiring: adopt `useInterfaceI18n` | Host-getter param; migrate item-player pair; toolkit optional after. | export signature change → api-report/pad/changeset; i18n suites | S–M | todo |

## Wave 2 — Package batches

| ID | Title | Scope & fix | Gates / impact | Size | Status |
|---|---|---|---|---|---|
| R-13 | Toolkit: neutrality back inside the gate | Add `tool-icons.ts` + `tools-config-normalizer.ts` to the scan list (coordinator already added upstream); the per-tool nested-merge and coordinator quoting left with the TTS lifecycle move; D6 (defaults to the composition layer) softened — defaults now isolated in `services/tool-provider-defaults.ts`, decision still open. | check widened + green; toolkit suites | S | in progress — coordinator + lifecycle move closed upstream (`ff8ab388`); remainder above |
| R-14 | Tool icons: registry complete, one markup path | Add `highlighter`/`strikethrough` entries; drop the eliminator's inline SVG; rename icon keys to shape names. | registrations tests; visual check | S | todo |
| R-15 | tts-settings declarations: drop the toolkit type | Local structural coordinator type; align toolkit dep to `devDependencies` across the five packages. | api-report regen + pad note; rides R-02's package | S | todo |
| R-16 | assessment-player batch | Hoist cycle-safe `sameContent` to players-shared (adopts item-list + assessment-player); fix `@fires` placement + regenerate manifest; delete `AssessmentReadinessChangeDetail`; type the section element; collapse navigation methods; drop the selector trio. | api-report regen; `check:custom-elements-manifest`; lifecycle spec | M | todo |
| R-17 | section-player batch | Delete five dead controller methods; extract `attachSectionPlayerTelemetry` (×4 → 1); extract card context wiring + shared chrome CSS; heading-id uniqueness via sectionId/mount counter; port `SectionSplitDivider` to pointer events; narrow `SessionChangedResult` (with R-22's pad batch if it touches published types). | typecheck + e2e; (a) internal-only | M | todo |
| R-18 | item-player batch | D7: markers (or canonicalize) for the two legacy behaviors; fix `showBottomBorder`; shared error banner in players-shared. | players-shared surface → api-report/pad/changeset; e2e session specs | S–M | todo |
| R-19 | players-shared: one tag-rewrite regex | Extract `rewriteExactTag`; `makeUniqueTags` maps through it; overrides copy leaves with R-22. | helper unit tests | S | todo |
| R-21 | AccessibilityCatalogResolver: retire the second store | Remove `itemCatalogs` + writers from resolver and published API; reconcile enumeration precedence; fix stale comment. | breaking published API → pad + changeset (batch with R-22) | S–M | todo |
| R-22 | Dead-surface hygiene batch (pre-release) | The R-22 list above; internal dead code deletes in owning packages' batch PRs. | per removal: pad row/trailer, api-report regen, patch changeset; time immediately before a release | M | todo |

## Wave 3 — Odds and ends

| ID | Title | Contents | Status |
|---|---|---|---|
| R-23 | Cross-package helper dedupe | `cloneUnproxied` (×4; keep orchestrator's throw), `errorMessage`, cortex `configureComputeEngine` + narrowed `validateExpression` param, desmos falsy-zero fix + test, version-suffix regex → `parseVersionedTagName`, debug-panel helpers into `-shared` (context anchor ×5, coordinator subscription ×2, clone/cap ×2, list scaffold CSS, drop redundant chrome + divergent `ToolkitCoordinatorLike`). | todo |
| R-24 | A11y tail | Annotation toolbar announcement keys (en-US + nl-NL); periodic-table `role="grid"` demotion + typed data import; magnifier typed element interface; shell dialog semantics if not in R-08. | todo |
| R-25 | Infra odds | CLI command inheritance; npm auth YAML → one script/composite action; drop root `resolutions`; CI dist-artifact comment-or-drop; local-esm-cdn dead `cache` field + eslint comments; svelte-check invocation consistency + documented suppressions; `SessionDbPanel` strings via `interfaceI18n`. | todo |
| R-26 | Decision sweep | Resolve D1–D8; each resolution spawns a ticket or closes with recorded rationale here. | todo |

## Decision log

| ID | Decision | Options | Proposed default | Resolution |
|---|---|---|---|---|
| D1 | `scripts/smoke-pie-elements-ng-esm.mjs` (~950 lines, zero callers) | wire into docs / delete | delete | pending |
| D2 | Escape-close semantics for obscuring overlay tools | page-wide close with `defaultPrevented` guard (magnifier, WCAG 2.4.11) / focused-panel only (line-reader) | page-wide | pending |
| D3 | `langId`/`lang_id` wire reconciliation | both spellings everywhere / single spelling | both spellings (client's documented camelCase accommodation) | pending |
| D4 | TTS cache module | add optional cache hook to `BaseTTSProvider`/`ITTSServerProvider` / document route-level caching as the story | add the hook | pending |
| D5 | Calculator shared runtime | tiny `calculator-shared` package / parity tests only | package (tts core/client split precedent) | pending |
| D6 | Move default-enabled toolkit providers to the composition layer | move (consumer-visible: hosts composing their own set no longer get two providers enabled by default) / keep in coordinator | move, with pad + changeset | pending |
| D7 | item-player legacy session projection | add `pie-item contract compatibility:` markers + covering tests / declare canonical and drop "legacy" phrasing | markers now | pending |
| D8 | Theme provider registry trio (`getPieThemeProvider`/`unregisterPieThemeProvider`) | keep (host-symmetric registry; Host M uses `register`) / trim | keep only if symmetry is intended | pending |

## Verification loop

After each wave: a focused delta re-review of the touched files (same method as
the 2026-11-03 refresh), and a re-triage of the remaining findings to catch
anything a refactor invalidated. Full local gate before any push
(`verify:local-pr`; Playwright outside the sandbox).

### Re-triage log

- **2026-11-04** — `develop` advanced ~40 commits while this tracker first
  landed (PRs up to #926). Verified before rebasing: no upstream change touched
  the R-01 targets (answer-eliminator strategies/README) or R-07's
  `ItemToolBar.svelte` effect; both branches rebased cleanly and re-verified.
  R-02's tts-settings half was closed upstream by PR #920 (`969b27ab`) while
  this tracker was in flight; its remaining scope is `DebugPanelToggles` and
  the class-hygiene gate. Upstream also landed adjacent work worth re-triaging
  against the finding list: `refactor/tts-shared-utils-contract`,
  `refactor/coordinator-tts-lifecycle`, `fix/print-player-declaration-closure`,
  `fix/ce-manifest-ts-classes` — a full re-triage of the remaining findings
  against the new `develop` is the next verification-loop step.
- **2026-11-04 (re-triage, `d6403f8a..origin/develop`)** — every non-dep,
  non-catalog commit checked against the finding list:
  - **R-10 narrowed** by `8abe1b28` + `ee1018da` (both cite the review's seam):
    `SpeechMark`/`anchorSpeechMarks`/`normalizeSpeechMarks`/
    `resolveSpeedRateBucket` moved into the `pie-tts` contract with server-core
    re-exporting, the duplicated `SpeedRateBucket` converged on the contract's,
    and the client dropped its server-core dependency. Still open: the
    SC/custom-transport request–response types remain duplicated across
    `tts-server-sc` and `tts-client-server` (the `langId` dual-send divergence
    and client-only inline `speechMarks` asymmetry included, so D3 stays
    open), Polly still hand-rolls its NDJSON parse with the
    fail-whole-synthesis robustness gap, the cache module still has no
    provider hook (D4), and Google/Polly still expose no request timeout.
  - **R-13 mostly closed** by `ff8ab388`: the TTS lifecycle (init, readiness,
    reconfiguration, degradation, missing-provider report, defaults, the
    capability-specific config merge; `textToSpeech` quoted 22×) moved out of
    `ToolkitCoordinator` into `services/tts/tts-lifecycle.ts` behind a
    `TtsLifecycleHost` adapter, packaged defaults into
    `services/tool-provider-defaults.ts`, and the coordinator joined
    `check-capability-neutrality`'s scan list. Remainder: `tool-icons.ts` and
    `tools-config-normalizer.ts` are still outside the scan list, and D6 is
    softened but open — the defaults are now isolated in a toolkit service
    rather than moved to the composition layer.
  - **No overlap found** for R-03, R-04, R-05, R-06, R-08, R-09, R-11, R-12,
    R-14, R-15, R-16–R-19, R-21, R-22: every named target file is unchanged
    upstream (`hashCode` still exported at `print-player/src/index.ts:48`;
    the overlay tools and the publish-surface check pair only took one-line
    dep bumps; `PieAssessmentToolkit.svelte` and
    `AccessibilityCatalogResolver.ts` untouched; `element-props.ts`
    unchanged). `94aaca50` removed a dead coordinator record guard (direction
    consistent with the tracker, no finding impact); `d1fdc735`'s manifest
    classes feature and `22a2e39c`'s section-player literal pin do not touch
    any finding.
  - **Plan correction absorbed:** R-10's "wire types once" home is now the
    `pie-tts` contract, following `8abe1b28`'s precedent — not
    `tts-server-core` as originally written.
