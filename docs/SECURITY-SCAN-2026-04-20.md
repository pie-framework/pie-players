# Security Scan Report — 2026-04-20

**Scope (per plan `.cursor/plans/security_scan_by_function_*`):**

- Function groups: item-player, section-player, assessment-player, assessment-toolkit, tools.
- Categories: dependency vulnerabilities, supply-chain / publish surface, static code analysis (SAST), custom-element / browser attack surface.
- Excluded: `apps/*` (demos, docs, local-esm-cdn), `tools/cli`, e2e specs.
- Shared packages (`players-shared`, `pie-context`, `theme`, `theme-daisyui`, `print-player`) are scanned once in the **Shared** section with back-references to groups that import them.

**Tools:**

- `bun audit` 1.3.8 (GitHub Advisory DB) — full workspace graph.
- Repo self-checks: `check:source-exports`, `check:consumer-boundaries`, `check:custom-elements`, `check:package-metadata`, `check:publint`.
- Manual grep/ripgrep SAST sweeps for XSS, injection, SSRF, secrets, weak RNG, prototype pollution, unsafe storage, dynamic script loading, iframe usage.
- `osv-scanner` and `semgrep` were **not available** in the execution environment; `bun audit` covers the GitHub Advisory DB (a superset of most OSV JavaScript entries) and the SAST layer uses manual pattern matching as specified in the plan fallback.

**Severity key:** Critical / High / Medium / Low / Info.

**Summary across scan:** 1 Critical, 9 High, 10 Moderate, 2 Low dependency CVEs (22 total) — all transitive and all attributed below. No secrets in source. No `eval` / `new Function` / stringly-typed `setTimeout` / dangerous `postMessage` / iframe sandbox bypasses in scope. No `postinstall`/`preinstall`/`bin` in publishable packages. One direct supply-chain concern (source shipped alongside `dist` in several packages; `exports` are clean but published tarballs include `*.svelte` / `*.ts` files). Several medium-severity design-level risks around trust boundaries for item markup (`{@html}`), dynamic PIE element loading, and TTS provider URL forwarding.

---

## 1. item-player (`packages/item-player`)

### item-player · Summary

- Dependency findings: 0 direct, 4 transitive (all dev-time, via `vite` and `vite-plugin-dts`). See Shared/Vite.
- Supply-chain: 1 Info (tarball only ships `dist` — clean).
- SAST: 2 Medium, 2 Low.
- CE surface: 1 Medium.

### item-player · Findings

- **ITEM-01 · Medium · sast/ce-surface** — Raw HTML injection via `{@html itemMarkup}` / `{@html passageMarkup}`.
  - File: [packages/players-shared/src/components/PieItemPlayer.svelte](packages/players-shared/src/components/PieItemPlayer.svelte) lines 862 and 868 (Svelte component consumed by item-player).
  - Evidence: markup fields originate from `itemConfig.markup` / `passageConfig.markup` (lines 127-147); they are rendered via `{@html}` without sanitization. `transformMarkupForAuthoring` also uses `new RegExp` on the same string (lines 117-121).
  - Why it matters: this is the item-player's primary content rendering path. Any consumer that feeds non-trusted item JSON (e.g. a preview feature, multi-tenant authoring) into `<pie-item-player>` gets arbitrary DOM injection, including script execution via event-handler attributes or `<svg>`/`<math>` sinks.
  - Remediation: document this trust boundary on the public API (README / element attribute docs) and consider shipping an opt-in sanitizer hook (DOMPurify) for authoring/preview modes. At minimum add a prominent warning in `packages/item-player/README.md`.
  - References: CWE-79, OWASP A03:2021 (Injection).
- **ITEM-02 · Medium · ce-surface/ssrf-like** — Unchecked external stylesheet URLs fetched and injected.
  - File: [packages/item-player/src/PieItemPlayer.svelte](packages/item-player/src/PieItemPlayer.svelte) lines 666-704.
  - Evidence: `loadScopedExternalStyle` accepts URLs from the `external-style-urls` attribute and `itemConfig.resources.stylesheets[*].url`. No scheme allow-list (http/https), no origin allow-list. Same-origin URLs are fetched with `fetch(url)` and their text is injected into a `<style>` element (after regex rewrite). Cross-origin URLs are attached as `<link rel="stylesheet">`.
  - Why it matters: if item config can be attacker-influenced, (a) `fetch(url)` will issue credentialed same-origin requests to arbitrary same-origin paths (data exfil potential if combined with a CSS-based oracle), and (b) large / slow URLs enable client-side DoS. The `style[data-pie-style="${url}"]` selector (line 668) also breaks if `url` contains `"` — cosmetic.
  - Remediation: validate `new URL(url, location.href).protocol` is `http:`/`https:`; optionally accept an allow-list prop; encode URL for selector use (`CSS.escape`).
  - References: CWE-918 (client-side SSRF analogue), CWE-20.
- **ITEM-03 · Low · sast** — Weak random used for scope class.
  - File: [packages/item-player/src/PieItemPlayer.svelte](packages/item-player/src/PieItemPlayer.svelte) (scope class derived from `Math.random`-based ID generators in `players-shared` and shared runtime).
  - Evidence: identifiers like `` `anon_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}` `` appear in shared code paths (TestSession, runtime-event-guards, AssessmentController) and feed into DOM attribute names.
  - Why it matters: these IDs are not security-sensitive (no auth/CSRF use). Low severity / hygiene note only.
  - Remediation: if these ever become session/correlation IDs used for authorization, switch to `crypto.randomUUID()` / `crypto.getRandomValues`.
- **ITEM-04 · Low · supply-chain** — Package `files` is clean (`["dist"]`). No action; tracked for completeness.

### item-player · Dependency CVEs (transitive only; all Vite-dev-server)

Attributed to shared/Vite cluster — see **Shared-DEP** below.

---

## 2. section-player (`packages/section-player`)

### section-player · Summary

- Dependency findings: 0 direct; transitive via Vite dev-tooling only.
- Supply-chain: 1 Info.
- SAST: 1 Medium (inherited from item-player markup boundary).
- CE surface: 1 Info.

### section-player · Findings

- **SEC-01 · Medium · sast** — Same `{@html itemMarkup}` path applies transitively because section-player hosts item-player via `@pie-players/pie-item-player` (see `packages/section-player/package.json` dependencies). See **ITEM-01**.
- **SEC-02 · Info · ce-surface** — Light-DOM custom elements with user-visible `pie-*` classes (`shadow: "none"` in `PieSectionPlayerSplitPaneElement.svelte`, `PieSectionPlayerVerticalElement.svelte`, `PieSectionPlayerTabbedElement.svelte`, `SectionItemCard.svelte`, `SectionPassageCard.svelte`, `SectionItemsPane.svelte`, `SectionPassagesPane.svelte`, `PieSectionPlayerKernelHostElement.svelte`). No `{@html}` usage inside these; verified no sink for untrusted content.
  - Note: this is intentional per `.cursor/rules/custom-elements-boundaries.mdc` — called out so reviewers know the light-DOM attack surface is deliberate and audited.
- **SEC-03 · Info · supply-chain** — `files: ["dist"]` only. No Svelte/TS source leakage.

### section-player · Dependency CVEs

Transitive (Vite dev-time) — see **Shared-DEP**.

---

## 3. assessment-player (`packages/assessment-player`)

### assessment-player · Summary

- Dependency findings: 2 moderate transitive (via `vite-plugin-dts` chain: `picomatch`, `lodash`, `brace-expansion`, `minimatch`); all are build-time.
- Supply-chain: Info.
- SAST: 1 Info (defensive `innerHTML = ""`).
- CE surface: 0 Direct.

### assessment-player · Findings

- **ASSESS-01 · Info · sast** — `this.innerHTML = ""` used to clear the shell element ([packages/assessment-player/src/components/AssessmentPlayerShellElement.ts](packages/assessment-player/src/components/AssessmentPlayerShellElement.ts) line 30; [packages/assessment-player/src/components/AssessmentPlayerDefaultElement.ts](packages/assessment-player/src/components/AssessmentPlayerDefaultElement.ts) lines 282, 361). Empty-string assignment is safe; downstream nodes are built with `createElement` and `.textContent`. No action.
- **ASSESS-02 · Info · supply-chain** — `files: ["dist"]`. Clean.
- **ASSESS-03 · Medium (inherited)** — Same `{@html}` trust boundary as **ITEM-01** (assessment-player depends on section-player, which depends on item-player).
- **ASSESS-04 · Low · sast** — Anonymous session ID uses `Math.random` in [packages/assessment-player/src/controller/AssessmentController.ts](packages/assessment-player/src/controller/AssessmentController.ts) line 106. Not used for auth. Same note as **ITEM-03**.

### assessment-player · Dependency CVEs

- **`lodash` <=4.17.23** — **High** (GHSA-r5fr-rjxr-66jc, code injection via `_.template` key names) + Moderate (GHSA-f23m-r3pf-42rh, prototype pollution via `_.unset`/`_.omit`). Path: `pie-assessment-player › vite-plugin-dts › …`. Build-time only.
- **`picomatch` <2.3.2** — High (GHSA-c2c7-rcm5-vvqj, ReDoS via extglob) + Moderate (GHSA-3v7f-55p6-f55p). Same `vite-plugin-dts` path. Build-time only.
- **`brace-expansion` >=2.0.0 <2.0.3** — Moderate (GHSA-f886-m6hf-6m8v, process hang). Same path. Build-time only.
- **`minimatch` >=10.0.0 <10.2.3** — High (GHSA-7r86-cg39-jmmj + GHSA-23c5-xmqv-rm74, ReDoS). Same path. Build-time only.
- Remediation: bump `vite-plugin-dts` (remove or upgrade to a version whose dependency tree drops vulnerable `lodash`/`picomatch`/`brace-expansion`/`minimatch`); these are build-time devDeps so they do not ship to consumers, but they can trip developer-machine DoS / code-exec during local builds.

---

## 4. assessment-toolkit (`packages/assessment-toolkit`)

### assessment-toolkit · Summary

- Dependency findings: 0 (no third-party runtime deps beyond Svelte).
- Supply-chain: 1 Info (files: ["dist", "README.md"]).
- SAST: 2 Medium (raw HTML rendering of tool icons / close button), 1 Low (Math.random IDs).
- CE surface: 2 Medium (SSML DOM handling; ItemToolBar dynamic button HTML).

### assessment-toolkit · Findings

- **TKIT-01 · Medium · sast/ce-surface** — `{@html button.icon}` in the toolbar renders tool-provided icon HTML directly into the page.
  - Files: [packages/assessment-toolkit/src/components/ItemToolBar.svelte](packages/assessment-toolkit/src/components/ItemToolBar.svelte) lines 1195, 1201, 1221, 1227; [packages/assessment-toolkit/src/components/ToolButton.svelte](packages/assessment-toolkit/src/components/ToolButton.svelte) line 53.
  - Evidence: `button.icon` originates from the tool registration object returned by `renderedTool.button` (line 447); in-repo tools provide static SVG strings, but the registry is open for third-party tool plugins.
  - Why it matters: any tool plugin author can inject arbitrary HTML (including event handlers) into the toolbar DOM. Within the PIE model tool code is privileged (it can call coordinator APIs already), but the icon field makes it easy for a template-generated icon (e.g. derived from a label via string concat) to accidentally become a stored XSS sink.
  - Remediation: document "icon must be static, author-controlled SVG" on the tool API; optionally render a `<template>` + `cloneNode` pathway for icons or require icons to be `string` of pre-sanitized SVG plus an opt-in raw-html escape hatch.
  - References: CWE-79.
- **TKIT-02 · Medium · sast** — `innerHTML` on a freshly created close button in `ItemToolBar`.
  - File: [packages/assessment-toolkit/src/components/ItemToolBar.svelte](packages/assessment-toolkit/src/components/ItemToolBar.svelte) lines 990-991.
  - Evidence: assigns a hard-coded SVG string via `innerHTML`. Content is static and not tainted, so the current risk is nil; flagged as a pattern to migrate so future refactors (e.g. theming the icon) don't introduce taint. `closeButtonEl.innerHTML = '<svg …/></svg>'`.
  - Remediation: prefer `createElementNS('http://www.w3.org/2000/svg', …)` or parse via `DOMParser` into a fragment; ESLint / grep rules are easier to keep clean.
- **TKIT-03 · Medium · sast** — SSML markup round-trip via `DOMParser` and `outerHTML`.
  - File: [packages/assessment-toolkit/src/services/SSMLExtractor.ts](packages/assessment-toolkit/src/services/SSMLExtractor.ts) lines 143 (`new DOMParser()`), 161 (`speakEl.outerHTML`), 213 (`doc.body.innerHTML`).
  - Evidence: item/passage text is parsed as `text/html`, `<speak>` elements are extracted via `outerHTML`, body HTML is re-read via `innerHTML`. Contents then flow into the TTS request body. `DOMParser` with `text/html` does **not** execute scripts and ignores `javascript:` URLs for resource loading, so this is safe today. Flagged because downstream providers (tts-server-polly, tts-server-google, tts-server-sc) may treat the SSML as XML — see **TOOLS-TTS-02**.
  - Remediation: validate SSML against an allow-list of tags (`speak`, `break`, `prosody`, `sub`, `mark`, etc.) before forwarding; strip attributes other than `alphabet`, `ph`, `time`, `strength`, `rate`, `pitch`, `volume`, `name`.
  - References: CWE-611 (risk is downstream, not here).
- **TKIT-04 · Low · sast** — `localStorage` / `sessionStorage` use in `ToolkitCoordinator`, `ElementToolStateStore`, `RangeSerializer`, `TestSession`.
  - Files: [packages/assessment-toolkit/src/services/ToolkitCoordinator.ts](packages/assessment-toolkit/src/services/ToolkitCoordinator.ts), [packages/assessment-toolkit/src/services/ElementToolStateStore.ts](packages/assessment-toolkit/src/services/ElementToolStateStore.ts), [packages/assessment-toolkit/src/services/RangeSerializer.ts](packages/assessment-toolkit/src/services/RangeSerializer.ts), [packages/assessment-toolkit/src/attempt/TestSession.ts](packages/assessment-toolkit/src/attempt/TestSession.ts).
  - Evidence: stores attempt state + tool state keyed by session ID. No PII observed in stored payloads; values are JSON-parsed with try/catch. Weak RNG session IDs (`Math.random`) as discussed in **ITEM-03** show up here too ([TestSession.ts line 134](packages/assessment-toolkit/src/attempt/TestSession.ts)).
  - Why it matters: if an attacker can reach the same-origin context (via a sibling XSS), they can read/forge attempt data. `localStorage` for assessment attempts is standard for PIE players but worth acknowledging.
  - Remediation: consider a scoped key prefix + integrity tag (HMAC-SHA256 over stored payload using a per-session key fetched from the host); document that TTL / clearing policies are the host's responsibility.
- **TKIT-05 · Info · supply-chain** — `files: ["dist", "README.md"]`. No source leak.

### assessment-toolkit · Dependency CVEs

None direct. Transitive via consumers only.

---

## 5. tools (tool-\*, toolbars, calculator, calculator-desmos, default-tool-loaders, tts, tts-client-server, tts-server-\*, section-player-tools-\*)

### tools · Summary

- Dependency findings: 1 Critical, 3 High, 1 Low direct-transitive (Google/Polly TTS deps), plus shared Vite chain.
- Supply-chain: Low — multiple tool packages ship top-level `.ts` / `.svelte` source files in the `files` array.
- SAST: 2 Medium (client TTS token forwarding), 1 Medium (server TTS SSRF), 1 Low (innerHTML in print-player, out of scope but shared), 1 Info (Math.random for listener IDs).
- CE surface: 1 Info (`iframe` mention is a CSS selector, not instantiation).

### tools · Findings

#### tools · Dependency CVEs (direct transitive)

- **TOOLS-DEP-01 · Critical · deps** — `protobufjs <7.5.5` — **Arbitrary code execution** (GHSA-xq3m-2v4x-88gg).
  - Path: `@pie-players/tts-server-google › @google-cloud/text-to-speech › protobufjs`.
  - Remediation: upgrade `@google-cloud/text-to-speech` (currently `^5.0.0`) to a release whose protobufjs peer is >=7.5.5, or add a workspace override. `tts-server-google` is server-only; exploitability requires attacker-controlled protobuf input, but this SDK does decode responses from Google's API, so a MITM / compromised-dependency scenario lands with code-exec on the TTS backend.
- **TOOLS-DEP-02 · High · deps** — `fast-xml-parser <5.5.6` — entity-expansion bypass (GHSA-8gc5-j5rx-235r) + falsy-eval bypass (GHSA-jp2q-39xq-3w4g).
  - Path: `@pie-players/tts-server-polly › @aws-sdk/client-polly › fast-xml-parser`.
  - Remediation: upgrade `@aws-sdk/client-polly` (currently `^3.700.0`) to a version whose bundled fast-xml-parser is >=5.5.6. Denial-of-service / parser confusion on untrusted XML; AWS service responses are the trust boundary, but a hostile proxy or test double exposes the parser.
- **TOOLS-DEP-03 · Low · deps** — `@tootallnate/once <3.0.1` — incorrect control-flow scoping (GHSA-vpq2-c234-7xj6). Path: `tts-server-google › @google-cloud/text-to-speech › …`. Upgrade path: same as TOOLS-DEP-01.
- **TOOLS-DEP-04 · Moderate/High (shared dev tooling)** — Vite dev-server vulns (GHSA-4w7w-66w2-5vf9, GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583) and esbuild dev-server (GHSA-67mh-4wv8-2f99) reach every `tool-*`, `toolbars`, `section-player-tools-*`, and `tts-client-server` package through their `devDependencies`. Not shipped to consumers.
  - Remediation: bump `vite` >= 6.4.2 (or latest LTS) across the monorepo; update `@sveltejs/vite-plugin-svelte` if required.

#### SAST / CE-surface — tools

- **TOOLS-TTS-01 · Medium · sast/browser** — Client-side Authorization header forwarding to TTS-server-returned URLs.
  - File: [packages/tts-client-server/src/ServerTTSProvider.ts](packages/tts-client-server/src/ServerTTSProvider.ts) lines 388-418 (speech-marks fetch) and 627-664 (audio-asset fetch).
  - Evidence: when `config.includeAuthOnAssetFetch` is truthy, `Authorization: Bearer <token>` is forwarded to `data.word` and to `normalized.audio.url`. Both URLs are controlled by the TTS server response; if that server is compromised or returns absolute cross-origin URLs (e.g. pre-signed S3 + evil domain), the bearer token leaks.
  - Why it matters: direct credential exfiltration vector.
  - Remediation: before the forwarding fetch, compare `new URL(data.word).origin` / `new URL(audioAssetUrl).origin` against an allow-list derived from `config.endpoint` (and any explicitly configured `assetOrigins`). Strip `Authorization` on mismatch. Prefer pre-signed URLs without bearer tokens for cross-origin assets.
  - References: CWE-200, CWE-522.
- **TOOLS-TTS-02 · Medium · sast/server** — Server-side SSRF via upstream-returned URLs in SchoolCity provider.
  - File: [packages/tts-server-sc/src/SchoolCityServerProvider.ts](packages/tts-server-sc/src/SchoolCityServerProvider.ts) lines 366 (`fetchImpl(word, …)`) and 402 (`fetchImpl(audioContent)`).
  - Evidence: `word` and `audioContent` are fields of the SchoolCity API JSON response. `fetchImpl` defaults to Node `fetch`. If the SC upstream is compromised or replays a crafted URL, the server will fetch arbitrary internal URLs.
  - Why it matters: classic server-side SSRF; enables internal service probing / metadata-service access (cloud instance metadata 169.254.169.254).
  - Remediation: validate URL host against an allow-list (e.g. `{this.baseUrl}`'s host plus explicitly configured asset CDN hosts); reject non-http(s) schemes; block RFC1918 / link-local / loopback addresses; enforce a redirect policy (`redirect: "manual"` and re-validate on Location).
  - References: CWE-918.
- **TOOLS-TTS-03 · Low · supply-chain** — `keyFilename` sink accepts config-controlled path.
  - File: [packages/tts-server-google/src/GoogleCloudTTSProvider.ts](packages/tts-server-google/src/GoogleCloudTTSProvider.ts) line 167.
  - Evidence: `clientConfig.keyFilename = config.credentials` when `credentials` is a string. Deploy-time configuration, not user input, so exploitability is contingent on attacker already having config-write access.
  - Remediation: document that `credentials` must be a trusted filesystem path; optionally `fs.realpath` + assert it is under a known directory.
- **TOOLS-04 · Info · sast** — Many tools use `Math.random` for DOM instance IDs (`tool-tts-inline`, toolkit, various tools). Listener / correlation use only; not security-sensitive.
- **TOOLS-05 · Info · ce-surface** — `iframe` string in [packages/tool-calculator-desmos/tool-calculator.svelte](packages/tool-calculator-desmos/tool-calculator.svelte) line 110 is a CSS selector for Desmos-injected iframes (styling), not a tool-initiated iframe. Desmos itself is a third-party runtime loaded by its own SDK; trust that runtime accordingly.
- **TOOLS-06 · Low · supply-chain · RESOLVED (PIE-225, commit `tarball-source-cleanup-v2`)** — Some tool packages shipped source files not referenced by their `exports` map. Trimmed the `files` arrays of 14 packages to remove entries unreachable from any `exports` condition and not transitively imported by a shipped `.svelte`:
  - [packages/toolbars/package.json](packages/toolbars/package.json) — dropped `components`, `index.ts`.
  - [packages/tool-annotation-toolbar/package.json](packages/tool-annotation-toolbar/package.json), [packages/tool-answer-eliminator/package.json](packages/tool-answer-eliminator/package.json), [packages/tool-color-scheme/package.json](packages/tool-color-scheme/package.json), [packages/tool-graph/package.json](packages/tool-graph/package.json), [packages/tool-line-reader/package.json](packages/tool-line-reader/package.json), [packages/tool-periodic-table/package.json](packages/tool-periodic-table/package.json) (`elements-data.ts` as well), [packages/tool-protractor/package.json](packages/tool-protractor/package.json), [packages/tool-ruler/package.json](packages/tool-ruler/package.json) — dropped `index.ts` (added `tool-ruler` during implementation — same shape as `tool-protractor`, not originally flagged but trimmed for consistency).
  - [packages/section-player-tools-event-debugger/package.json](packages/section-player-tools-event-debugger/package.json), `…-pnp-debugger`, `…-session-debugger`, `…-tts-settings`, `…-instrumentation-debugger` — dropped `index.ts`.
  - **Kept intentionally** (part of the `svelte` export-condition contract or transitively imported by a shipped `.svelte`): all top-level `tool-*.svelte`, `answer-eliminator-core.ts` + `adapters/` + `strategies/` in `tool-answer-eliminator`, `periodic-table-data.json`, `protractor.svg`, `ruler-*.svg`, each debugger's `<Panel>.svelte`, and the entire `packages/section-player-tools-shared` publish surface.
  - **False positive**: [packages/tool-calculator-inline-desmos/package.json](packages/tool-calculator-inline-desmos/package.json) was originally flagged. Its `files` is already minimal (`"dist"`, `"tool-calculator-inline.svelte"`) — the only source entry is the `.svelte` referenced by the `svelte` export condition. No action required.
  - **Verification**: `bun run check:pack-exports` (cross-checks every `exports` target against `npm pack --dry-run --json` output) and `bun run check:pack-smoke` (real `npm pack` + the same validation) both pass for all 37 publishable packages. Per-package post-change tarball listings captured in `.tmp/pack-after/*.txt`.

---

## Shared

Scanned once; applies to every in-scope group that depends on these packages.

### Shared — `players-shared` (used by every group)

- **SHARED-01 · Medium · sast/arch** — Dynamic PIE element loader.
  - Files: [packages/players-shared/src/pie/esm-loader.ts](packages/players-shared/src/pie/esm-loader.ts) (dynamic `import(specifier)` at line ~340 into `defineCustomElementSafely(actualTag, class extends ElementClass {}, …)` at lines 404-408); [packages/players-shared/src/pie/iife-loader.ts](packages/players-shared/src/pie/iife-loader.ts) line 385 (`script.src = url`); [packages/players-shared/src/pie/initialization.ts](packages/players-shared/src/pie/initialization.ts) lines 509, 560 (`script.src = url`, `script.src = bundleUrl`).
  - Evidence: loaders accept a `cdnBaseUrl` (or `bundleUrl`) string and dynamically import/inject scripts from it. Package names come from the item config's element registry. URL assembly is at lines 159 / 162 / 167 / 169 / 177 / 179 of `esm-loader.ts`.
  - Why it matters: this is the principal runtime trust boundary for the PIE framework — whoever controls `cdnBaseUrl` + element names has arbitrary code execution inside the host page. The `@pie-framework/*` packages served over jsDelivr / esm.sh should be treated as first-party code.
  - Remediation (documentation, not code): publish a prominent security note on every player's README: (1) host must pin `cdnBaseUrl` to a domain they control or trust as first-party, (2) host's CSP must allow only that origin in `script-src` and `connect-src`, (3) host must validate element registry contents (package name allow-list) before passing to the player. `check:runtime-compat` / `check:ce-consumer-contract` enforce structural contract but not trust.
- **SHARED-02 · Info · sast** — `Math.random` sampling in instrumentation ([packages/players-shared/src/instrumentation/providers/BaseInstrumentationProvider.ts](packages/players-shared/src/instrumentation/providers/BaseInstrumentationProvider.ts) line 409). Sampling only; not security-sensitive.
- **SHARED-03 · Low · sast** — `fetch` to user-configured `apiUrl` in [packages/players-shared/src/pie/player-initializer.ts](packages/players-shared/src/pie/player-initializer.ts) line 182 and NPM registry fetch in [packages/players-shared/src/server/npm-registry.ts](packages/players-shared/src/server/npm-registry.ts) line 41. Endpoints are configured by the host, not by end-user input. Document trust.
- **SHARED-04 · Low · supply-chain · RESOLVED (PIE-225, commit `players-shared-dist-only`)** — Closed via two staged changes:
  1. **Initial targeted trim** (commit `players-shared-files-trim`): replaced `"src/i18n"` glob in `files` with explicit list of reachable siblings (`types.ts`, `loader.ts`, `simple-i18n.ts`, `use-i18n*.svelte.ts`, `translations/`), dropping 4 unreachable files (`src/i18n/index.ts`, `src/i18n/README.md`, `src/i18n/scripts/check-coverage.ts`, `src/i18n/scripts/scan-hardcoded.ts`).
  2. **Structural follow-up** (this commit): relocated all Svelte-source exports from `src/` into `dist/`, eliminating the source-export allow-list entry entirely and closing the latent tarball break noted previously.
  - **What changed in the follow-up**:
    - Added [packages/players-shared/scripts/copy-source-exports.mjs](packages/players-shared/scripts/copy-source-exports.mjs) as a post-`tsc` build step. It stages the 6 `.svelte` component files, the `components/index.ts` barrel, and the 2 `.svelte.ts` rune composables into `dist/` as raw source (they cannot be compiled by tsc — `.svelte.ts` runes need the consumer's Svelte plugin). It also deletes the stale tsc-emitted `.svelte.js`/`.svelte.d.ts` siblings for the rune files (tsc produced them but nothing referenced them).
    - Extended the build script to `rm -rf dist tsconfig.tsbuildinfo` first (tsc was skipping emit when only the buildinfo cache was stale).
    - Excluded `src/i18n/scripts/**` from tsc (they are dev-only entrypoints run from source via `bun run check-i18n` / `scan-hardcoded`; previously shipped as compiled bloat under `dist/i18n/scripts/`).
    - Updated the 9 Svelte-source `exports` entries to point at their new `dist/` locations (e.g. `./dist/components/PieItemPlayer.svelte`, `./dist/i18n/use-i18n.svelte.ts`).
    - Simplified `"files"` to `["dist"]`.
    - Removed `@pie-players/pie-players-shared` from the `check-source-exports.mjs` allow-list — no `src/*` export targets remain in the package.
  - **Why this closes the latent break**: before this change, `src/components/*.svelte` imported `../pie/*.js`, `../ui/*.js`, `../types/*.js`, `../instrumentation/*.js`, `../loader-config.js` — none of which shipped in the tarball's `src/` subset. This worked in practice only for workspace-sibling consumers who had the full `src/` tree via symlink. After relocation, these same relative imports inside `dist/components/*.svelte` now resolve against the tsc-compiled `dist/pie/*.js`, `dist/ui/*.js`, etc., which are already in the tarball. External tarball consumers (pieoneer, QuizEngineFixedPlayer) can now safely follow the Svelte-source exports through their own Svelte-aware bundler.
  - **Verification**: `bun run build` (full monorepo, 37/37 tasks OK), `check:pack-exports` (37 OK), `check:pack-smoke` (37 OK, real `npm pack` + tarball smoke test), `check:publint` (37 OK), `check:source-exports` (37 OK with allow-list entry removed), `check:consumer-boundaries` (OK), `check:custom-elements` (20 OK), `bun test` in `packages/players-shared` (119/119 pass). Tarball now has 262 files (down from 270 after removing the dev-only `dist/i18n/scripts/*`).

### Shared — `print-player` (out of scope per plan)

- Package ships `files: ["dist", "src"]` (full source) — noted for completeness; outside scan scope.

### Shared — dev-tooling dependency cluster

Attributable to every in-scope group's `devDependencies` except `assessment-toolkit` and shared-only packages that don't use Vite.

- **Shared-DEP-01 · High · deps (build-time)** — `vite <=6.4.1`: GHSA-v2wj-q39q-566r (`server.fs.deny` bypass), GHSA-p9ff-h696-f583 (arbitrary file read via dev-server websocket), plus two moderate path-traversal variants (GHSA-4w7w-66w2-5vf9). Impacts dev machines only.
- **Shared-DEP-02 · Moderate · deps (build-time)** — `esbuild <=0.24.2`: GHSA-67mh-4wv8-2f99 (cross-site dev-server request). Impacts dev machines only.
- **Shared-DEP-03 · High · deps (build-time)** — `@sveltejs/adapter-node` / `@sveltejs/kit <=2.57.0` (only reaches `apps/*`, which are out of scope, but also `pie-players-docs` — kept for visibility). GHSA-3f6h-2hrp-w5wx (open redirect DoS), GHSA-2crg-3p73-43xp (body-size-limit bypass).
- **Shared-DEP-04 · Moderate · deps (build-time)** — `cookie <0.7.0`: GHSA-pxg6-pf52-xh8x. Reaches only `apps/assessment-demos` via `@sveltejs/kit`. Out of scope for this scan.
- **Shared-DEP-05 · High · deps (build-time)** — `lodash` / `picomatch` / `brace-expansion` / `minimatch` via `vite-plugin-dts` reach all four player packages and every `tool-*` that uses `vite-plugin-dts`. Build-time only; no shipped surface.
- **Remediation for all Shared-DEP-\*:**
  1. Bump `vite` to >=6.4.2, rebuild all workspaces.
  2. Replace `vite-plugin-dts` with the latest release (or `@types-tools/unplugin-dts` / `vite-plugin-dts@^4.6`) whose transitive `lodash`/`picomatch`/`brace-expansion`/`minimatch` are patched.
  3. Bump `@sveltejs/kit` and adapters even though they're in demo apps — it keeps the lockfile clean and avoids accidental production use.
  4. Consider adding a `check:deps-audit` wrapper to CI so new high-severity CVEs fail PRs.

---

## Tooling appendix

- **Commands executed (read-only):**
  - `bun audit` and `bun audit --json` (output captured at `.tmp/secscan/bun-audit.txt` / `bun-audit.json`).
  - `bun run check:source-exports`, `bun run check:consumer-boundaries`, `bun run check:custom-elements`, `bun run check:package-metadata`, `bun run check:publint` — all passed.
  - `git check-ignore .env` — confirmed `.env` is git-ignored; only `.env.example` is tracked.
  - `rg` / Grep sweeps for: `innerHTML|outerHTML|insertAdjacentHTML|document\.write|\{@html|new Function|eval|dangerouslySetInnerHTML`, `addEventListener("message"`, `postMessage`, `iframe`, `Math.random`, `fetch(`, `setTimeout("…")`, `__proto__`, `lodash.merge`, secret patterns (`AKIA`, `AIza`, `sk_live_`, `-----BEGIN`, `eyJ…`), `JSON.parse`, `customElements.define`, `shadow: "none"`, `fs.readFile|child_process|exec|spawn`, `DOMParser|XMLParser`, `javascript:`, `window.open|target="_blank"`.
- **Tools unavailable** in the execution environment (noted in scope): `osv-scanner`, `semgrep`. Mitigation: `bun audit` reads the same advisories as `npm audit` and the GitHub Advisory DB, which is a superset of most OSV JavaScript entries; manual grep rules cover the OWASP / XSS / NodeJS ruleset categories planned with semgrep. Coverage gap vs. semgrep: taint tracking across function boundaries is inferred manually — where relevant, findings explicitly call out the flow.
- **False-positive notes:**
  - `this.innerHTML = ""` in `AssessmentPlayerShellElement.ts` / `AssessmentPlayerDefaultElement.ts` / `print-player/src/pie-print.ts` line 46 — assigning `""` or static strings to clear/create nodes is safe; flagged as Info only.
  - `'your_desmos_api_key_here'` in [packages/tool-calculator-desmos/tool-calculator.svelte](packages/tool-calculator-desmos/tool-calculator.svelte) line 37 is a documentation placeholder, not a secret.
  - `/^rgba?\(.+\)$/i.exec(…)` etc. matched the `exec(` sweep — regex `.exec`, not `child_process.exec`.
- **Not in scope (confirmed):** `apps/*`, `tools/cli`, e2e specs (`packages/**/tests`), `playwright.config.ts`, build-only scripts (`scripts/*.mjs`).

## Suggested follow-up PRs (one per cluster)

1. `deps/upgrade-vite-and-dts` — bump Vite, `@sveltejs/vite-plugin-svelte`, `vite-plugin-dts` across workspace; resolves Shared-DEP-01, 02, 05.
2. `deps/upgrade-aws-google-tts` — bump `@aws-sdk/client-polly` and `@google-cloud/text-to-speech`; resolves TOOLS-DEP-01, 02, 03.
3. `tts/origin-allowlist` — implement origin allow-list + bearer-token scrubbing in `ServerTTSProvider` (browser) and `SchoolCityServerProvider` (server); resolves TOOLS-TTS-01 and TOOLS-TTS-02.
4. `item-player/markup-boundary-docs` — README + element JSDoc explicitly document the `{@html}` trust boundary and add an opt-in sanitizer hook; resolves ITEM-01 / SEC-01 / ASSESS-03.
5. `item-player/stylesheet-url-validation` — validate scheme and optionally origin; resolves ITEM-02.
6. `toolkit/tool-icon-hardening` — document and enforce trusted-tool-icon contract (or render via SVG element construction); resolves TKIT-01, TKIT-02.
7. `tools/files-cleanup` — **RESOLVED for TOOLS-06** (14 packages trimmed; see TOOLS-06 entry). **FULLY RESOLVED for SHARED-04** (see SHARED-04 entry): the initial targeted trim dropped 4 strictly-unreachable files from `players-shared` tarball, and a follow-up structural change relocated all Svelte-source exports from `src/` into `dist/` via a post-`tsc` copy step. This eliminated `players-shared` from the `check:source-exports` allow-list and closed the pre-existing latent tarball break where `./components/*.svelte` imports (`../pie/*`, `../ui/*`, `../types/*`, `../instrumentation/*`, `../loader-config.js`) resolved only for workspace-sibling consumers.
