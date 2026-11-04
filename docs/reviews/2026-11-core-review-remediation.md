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
- One execution batch below = one branch and PR, with one patch changeset for
  published changes citing every included R-id. Use the leading R-id in the
  branch name and all included ids in the PR title/body. Infrastructure-only
  batches retain their no-changeset exception. This replaces the original
  one-item rule where the batch explicitly groups items.
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

## Maintainer authorizations — 2026-11-04 decision review

These decisions supersede the pending/defer recommendations in the execution
plan and client-impact table below where they conflict. They authorize scope,
not a claim that consumer verification or implementation has already happened.

- **D6:** keep coordinator provider defaults as intentional 1.0 behavior;
  document them and test explicit overrides.
- **D4:** keep route-level TTS caching; verify the documented integration and
  add no provider cache hook for 1.0.
- **D5:** keep calculator adapter implementations separate for 1.0 and fill
  meaningful lifecycle-test gaps. The maintainer expects Desmos to be the
  practical client choice and considers its package stable; no new shared
  calculator package is justified now.
- **R-12 / i18n:** refactor the i18n API into the intended 1.0 shape, including
  breaking changes if useful. The maintainer reports no current i18n consumers
  except the internally controlled API host and authorizes fixing that host,
  repository documentation and published Confluence pages. Verify the actual
  callers before changing them. This authorization is scoped to i18n.
- **R-22 / cleanup policy:** aggressively remove duplication, obsolete backward
  compatibility constructs/shims and APIs unnecessary for 1.0. Check the known
  clients through the consumer-pad procedure to establish actual impact; do
  not retain code solely because it was once published. The exact-list approval
  hold in batch 12 is lifted for verified unnecessary surfaces. This is not
  blanket permission to remove behavior still required by a known client: bring
  back concrete client breakage needing a product decision. Existing permission
  to fix internally controlled consumers applies; i18n explicitly includes its
  API host. This policy does not reverse D4/D5/D6 or authorize publishing.
- **D7/D8:** evaluate shims and registry exports under that cleanup policy;
  neither all session shims nor the theme lifecycle is automatically retained
  or deleted. Establish client need and purposeful 1.0 contract first.

## Sequential execution plan — 1.0 stabilization

Reordered 2026-11-04 at the maintainer's request. Execute the numbered batches
in order, merge each before branching the next from fresh `origin/develop`, and
re-verify the included findings first. These tables replace the former wave
order. The findings appendix remains the evidence inventory; a listed finding
is not authorization to execute every cleanup it originally proposed.

The sequence is executable without architectural decisions: where an optional
change is still pending, keep existing behavior and leave that part open. No
D1–D8 decision has been approved by this reorder. Client-visible corrections
below are recommendations awaiting maintainer approval, not recorded approvals.

A batch closes only its stated scope. An R-id spanning batches stays partially
open until its remaining scope is completed or explicitly declined. Do not count
verified local work as merged. R-26 is decision bookkeeping throughout the run
and a final audit, rather than a decision prerequisite left until the end.

### Wave 0 — Correct defects and establish trustworthy release checks

| Order / branch anchor | Included scope, performed together | Verification / completion condition | Status |
|---|---|---|---|
| 1 / R-01, then R-07 | Finish the two existing branches as separate PRs; do not combine or rewrite already verified fixes merely to fit the new grouping. R-01 restores accessible undo; R-07 defers tracked-effect writes. | Re-verify against current develop, per-item tests and full push gate; changeset in each; record PR and merge separately. R-07 must merge before batch 5. | R-01: locally verified c84fa59f, PR/remote state needs recheck. R-07: locally verified a484e36c, PR/remote state needs recheck. |
| 2 / R-04 | Make source-export and pack-integrity validation share the existing collectors. Keep existing command entrypoints initially. Leave unrelated script deletions and D1 out. | `check:scripts`, collector regression tests, both validation callers agree on build-config declarations; no changeset. | todo |
| 3 / R-02 + R-15 | Finish self-contained debug-panel styles and their class gate; fix tts-settings declarations to use the minimal structural coordinator contract. Inspect all five packages, but change dependency classification only where runtime imports permit it. | Non-DaisyUI visual/keyboard check; panel tests; declaration consumer check without toolkit/skipLibCheck; API report, pad, packaging checks and changeset. Upstream TTS styling is retained. | partial: R-02 TTS panel half shipped upstream; remainder and R-15 todo |
| 4 / R-03 + R-13 + R-14 + annotation portion of R-24 | One icon pass: centralize FA pin/detection/shadow installation; wire all three consumers; complete fallback glyphs; migrate affected registrations and widen neutrality checks in the same PR. Localize annotation announcements while those controls are under verification. Preserve current provider defaults and public icon keys; defer a rename if it would break callers. | FontAwesome asset/browser specs, single-pin guard, registration and neutrality tests, visual checks, API report/pad for added shared surface; changeset. R-13/R-14 land atomically. | todo; R-13 upstream coordinator work already closed |

### Wave 1 — Interaction and data correctness

| Order / branch anchor | Included scope, performed together | Verification / completion condition | Status |
|---|---|---|---|
| 5 / R-05 + R-06 + R-08 + magnifier portion of R-24 | One overlay pass: shared lifecycle and announcement cleanup, composed-ancestor and unmount-key ownership, shell module and named-dialog semantics, typed magnifier seam. Extract shell without redesigning geometry or focus behavior. Preserve each tool's Escape policy unless D2 is approved first. | All four tool contracts and shell E2E, geometry/focus seam tests, teardown/unmount regression checks; API report/pad for shared exports and host attributes; changeset. Requires merged R-07. | todo |
| 6 / R-09 | Move composition snapshot/revision logic out of the element after the overlay pass; preserve revision keys and event emission behavior. | Runtime tests pin equivalent snapshots, revisions and emission cardinality; changeset. | todo |
| 7 / R-10 | One TTS correctness pass: converge parsing and wire definitions on the existing contract; preserve current request spellings, precedence and response acceptance. Polly retains valid marks when a line is malformed. No cache hook, wire normalization or default timeout change without explicit approval. | TTS contract/server/client tests, malformed-mark cases, wire compatibility cases, API report/pad and changeset for added declarations. | partial: bucket/word-timing convergence upstream; remaining scope todo |
| 8 / R-16 + R-17 + remaining R-24 | One player-boundary pass: cycle-safe comparison shared with item-list, accurate event manifest, typed section integration, globally unique internal heading IDs, pointer-based split divider, correct periodic-table semantics. Do not change PIE/model IDs. Include only local dedupe needed for these fixes. Public method/type/selector removals go exclusively to batch 12. | Cyclic-session regression, manifest check, lifecycle/navigation tests, multi-player heading and pointer/keyboard browser checks; API report/pad for shared helper or declarations; changeset. | todo |
| 9 / R-12 + R-18 + SessionDbPanel portion of R-25 | One locale/session UI pass: adopt existing i18n wiring where current signature permits it; add D7 compatibility markers/tests without changing session projection; fix border cleanup/remount; localize debugger strings. Avoid extracting a new shared error-banner component or breaking the i18n helper signature solely for dedupe. | Locale loading/failure and session tests, border remount check, API report/pad if a signature must change; stop for approval before a break; changeset. | todo |
| 10 / correctness subset of R-19 + R-21 + R-23 | Finish isolated correctness defects: calculator zero result, versioned-tag parsing, catalog enumeration matching scoped lookup. Preserve published catalog writers/store during this pass. Consolidate tag rewriting only if behavior can be pinned without widening scope; override-loader removal stays in batch 12. | Zero regression, full versioned-tag/contract-ID tests, duplicate catalog-ID precedence test; pad assessment and changeset for observable fixes. | todo |

### Wave 2 — Conditional cleanup after the defect pass

These batches do not block 1.0 merely because the review found duplication or
unused code. Reassess after batch 10; execute only with an approved benefit or
an observed release risk. Their pending status is not an instruction to delay
release until every original finding is eliminated.

| Order / branch anchor | Grouped scope | Admission / gates | Status |
|---|---|---|---|
| 11 / R-11 + remaining R-23, then remaining R-25/R-04 | Calculator lifecycle/telemetry and helper dedupe together if a demonstrated leak/divergence warrants it; otherwise defer the new package (D5). Separately finish release-infrastructure cleanup only where it fixes a verified gate/build risk. Unused smoke tool (D1), auth refactors, resolutions removal and broad svelte-check alignment are not automatic stabilization work. | Package/fixed-versioning checks if D5 approved; relevant regressions and scripts tests; separate runtime and infrastructure PRs rather than one cross-cutting cleanup PR. | deferred recommendation; pending maintainer disposition |
| 12 / R-22 + removal portions of R-16/R-17/R-21 | One explicit public-surface batch: exact symbol list, consumer verification and migration notes before editing. Includes assessment readiness type/selectors, public controller methods and session-result narrowing, catalog-store writers, and the R-22 inventory. D8 governs registry retention. No removals elsewhere. | Maintainer-approved removal list; pad procedure, API report, type/consumer and packaging checks; patch changeset names affected host shapes. If approved, land immediately before the coordinated lockstep release, with time for release-candidate verification. Publishing itself needs a separate instruction. | held; no blanket approval and no scheduled release |
| 13 / R-26 | Audit every original R-id and D-id: completed scope, deferred scope with rationale, remaining client impacts, and release-candidate evidence. | No silent omissions; unresolved choices cannot be treated as accepted defaults. | ongoing, final audit after applicable batches |

## Client-visible changes: the 1.0 case

The bar is a broken supported workflow, an accessibility defect, incorrect data,
or an installation/typechecking failure. Dedupe alone does not justify new API
or changed behavior during stabilization. Each row below still needs pre-item
verification; the review references are evidence to investigate, not a fresh
consumer audit.

| Change | Why take it before 1.0? | Recommended boundary / approval needed |
|---|---|---|
| Accessible undo, named tool dialogs, valid periodic-table semantics, unique heading IDs (R-01/R-08/R-17/R-24) | A learner must be able to find, understand and operate the existing controls. Shipping inaccessible controls would freeze a known defect into the release. | Approve semantic corrections; retain focus/geometry behavior and contract IDs; browser/assistive-technology evidence where relevant. |
| Self-styled panels and fixed coordinator declarations (R-02/R-15) | Registration-only integration must work without a host CSS framework, and its types must compile without an undeclared toolkit dependency. These repair the package's existing delivery promise. | Approve required PIE styles and minimal structural declarations; no theme redesign or blanket dependency moves. |
| Missing glyphs and localized existing announcements (R-03/R-14/R-24/R-25) | Blank icon-only controls obscure available actions. Existing locale selection should govern the labels users hear. | Approve missing-glyph/translation fixes; retain host FA/Pro behavior and public icon keys. Shared helper exports are justified only for actual package consumers. |
| Overlay lifecycle consolidation / Escape change (R-05/R-06/R-08, D2) | Shared teardown can prevent stale listeners, orphan shells and focus bugs; a large extraction also carries regression risk. The extraction is justified only with equivalent behavior pinned by tests. | Preserve Escape behavior initially. Page-wide dismissal is a separate interaction decision, not required merely to share lifecycle code. |
| TTS malformed marks, wire declarations, timeout/cache proposals (R-10, D3/D4) | One bad timing line should not discard usable speech. Shared declarations can prevent the existing transports from drifting. | Approve parser resilience and behavior-preserving type convergence. Preserve wire inputs. Defer cache API and default timeouts until a concrete requirement and failure policy justify them. |
| Cycle safety, border remount, pointer divider, calculator zero, catalog precedence (R-16/R-17/R-18/R-21/R-23) | These fix crashes, lost styling, unavailable input interaction, wrong evaluation output and disagreement about which authored alternative wins. | Approve narrowly tested corrections. Catalog precedence is visible for duplicate IDs: confirm the scoped-lookup rule is intended before changing enumeration. |
| I18n helper signature / shared UI exports (R-12/R-18) | Reusing a helper is useful but is not by itself a reason to make hosts migrate or publish another component. | Preserve the public signature where possible; defer extraction if it requires a breaking signature without a demonstrated user defect. |
| Provider defaults (D6) | No stabilization case established: upstream already isolated the defaults. Moving ownership can silently remove read-aloud and annotation tools for custom compositions. | Recommend keeping behavior through 1.0; pending maintainer decision. |
| Cache hook / calculator package (D4/D5) | No current caller for the hook or need for a new package has been established in this review. Both expand the contract we must stabilize. | Recommend defer; fix any concrete calculator lifecycle defect without requiring a new public package first. |
| Published removals / theme registry (R-22, D8) | Before 1.0 is the last convenient point to avoid committing to accidental APIs, but absence of observed use is weaker evidence than a broken contract. | No general deletion mandate. Remove only an approved exact list with consumer evidence and migration cost justified; otherwise retain. |

The plan recommendations above do not resolve the decision log. In particular,
D3 precedence, D2 dismissal, default timeouts and the exact removal list remain
explicit client-impact decisions. D7's recommended path preserves behavior.

## Decision log

| ID | Decision | Options | Proposed default | Resolution |
|---|---|---|---|---|
| D1 | `scripts/smoke-pie-elements-ng-esm.mjs` (~950 lines, zero callers) | wire into docs / delete | delete | pending |
| D2 | Escape-close semantics for obscuring overlay tools | page-wide close with `defaultPrevented` guard (magnifier, WCAG 2.4.11) / focused-panel only (line-reader) | page-wide | pending |
| D3 | `langId`/`lang_id` wire reconciliation | both spellings everywhere / single spelling | both spellings (client's documented camelCase accommodation) | pending |
| D4 | TTS cache module | add optional cache hook to `BaseTTSProvider`/`ITTSServerProvider` / document route-level caching as the story | route-level caching | resolved: keep route-level caching; no provider hook for 1.0 |
| D5 | Calculator shared runtime | tiny `calculator-shared` package / parity tests only | separate implementations for 1.0 | resolved: no new package; meaningful lifecycle parity tests |
| D6 | Move default-enabled toolkit providers to the composition layer | move (consumer-visible: hosts composing their own set no longer get two providers enabled by default) / keep in coordinator | keep defaults | resolved: preserve coordinator defaults, document and test overrides |
| D7 | item-player legacy session projection | add `pie-item contract compatibility:` markers + covering tests / declare canonical and drop "legacy" phrasing | markers now | pending |
| D8 | Theme provider registry trio (`getPieThemeProvider`/`unregisterPieThemeProvider`) | keep (host-symmetric registry; Host M uses `register`) / trim | keep only if symmetry is intended | pending |

## Verification loop

After each execution batch: a focused delta re-review of the touched files (same method as
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

- **2026-11-04 (stabilization reorder)** — replaced item-by-item wave order
  with sequential execution batches, grouped same-owner fixes and their gates,
  moved every published removal into the conditional R-22 batch, and separated
  defect repair from optional architecture/cleanup. D1–D8 remain pending; this
  edit records recommendations, not authorization. No item was marked fixed
  based on the reorder.
