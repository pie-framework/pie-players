# @pie-players/pie-theme-daisyui

## 0.3.67

### Patch Changes

- Updated dependencies [73d2be4]
- Updated dependencies [73d2be4]
  - @pie-players/pie-theme@0.3.67

## 0.3.66

### Patch Changes

- e8a6f0e: Add `--pie-content-emphasis` and take `.content-emphasis` from it.

  The previous fix mixed 65% red toward `--pie-text`, on the strength of two
  measurements. Sweeping all 35 shipped themes showed that was not enough: the mix
  falls under SC 1.4.3's 4.5:1 on seven of them, and lands at 2.91:1 on `aqua`.
  Lowering the red share does clear every theme, but only at 25%, where the colour
  is no longer recognisably the red the content author chose.

  The token is mapped from the DaisyUI error slot through the same `legible`
  correction `--pie-incorrect` uses, which is the one construction that clears
  4.5:1 against the page on all 35 — measured, not assumed. Its base-theme values
  are a red chosen for the same bar (7.4:1 on the light page, 7.3:1 on the dark
  one), and each built-in colour scheme mirrors the red it already declares for
  `--pie-incorrect`.

  A canonical entry rather than a package-private hook: authored content is host
  content, so which red emphasis takes is a host decision, and the value has to
  participate in colour schemes.

- 6bbfae1: Resolve DaisyUI's palette to PIE tokens a learner can see, from one table instead
  of four copies.

  The same 47-row slot-to-token table was written out four times: the provider
  adapter in `@pie-players/pie-theme`, `mapDaisyThemeToPieVariables` and
  `mapResolvedDaisyThemeToPieVariables` in `@pie-players/pie-theme-daisyui`, and that
  package's `bridge.css`. Two defects lived in the drift between them, and the parity
  test meant to catch drift compared only which token names each copy declared, never
  which slot a token derived from.

  `DAISYUI_PIE_TOKEN_MAP` in `pie-theme` is now the single table, and one renderer
  serves all three JS mappers. `bridge.css` cannot import it, so the parity test now
  holds it to the table expression by expression. Three copies of the table are gone.

  ## An unanswered question was painted as a wrong one

  `--pie-missing` and `--pie-incorrect` both resolved to `--color-error`, so under
  every DaisyUI theme an unanswered question and a wrong one were the same colour.
  `--pie-missing` now takes `--color-warning`, the mapping the rest of PIE already
  declares: pie-elements-ng keys it to `warning`, and the assessment toolkit's
  `.pie-warning` rule paints it.

  ## Feedback marks and control boundaries were unreadable

  DaisyUI's semantic slots are background colours — `--color-success` is chosen to
  sit behind `--color-success-content` — while PIE paints `--pie-correct`,
  `--pie-incorrect` and `--pie-missing` as `color:`. Taken verbatim, the correct mark
  measured 1.26:1 against the page under `acid` and 1.96:1 under `light`, against SC
  1.4.3's 4.5:1.

  `--pie-border` and `--pie-button-border` have the same shape of problem against SC
  1.4.11's 3:1. They map to `--color-base-300`, a surface tint, so a boundary painted
  with it sits between 1.09:1 and 1.53:1 across the shipped themes. What makes that a
  defect rather than a subtle divider is that `--pie-button-bg` resolves to
  `--color-base-100`, the page's own colour: for a toolbar button, an answer-eliminator
  toggle, or the inline TTS control, that border is the only thing separating the
  control from the page behind it. `--pie-border-dark` is corrected too, since
  `--color-neutral` collapses to 1.09:1–1.85:1 against the page in dark themes, taking
  the graph tool's grid lines with it.

  The repo already had one component routing around this: the annotation toolbar was
  given its own contrast-checked border token because, as the note in
  `color-schemes.css` puts it, `--pie-border` "carries a surface tint that leaves the
  outline at ~1.1:1". Correcting the token means the next component does not need its
  own escape hatch.

  The selected button surface had the related inverse problem. DaisyUI chooses
  `--color-base-content` against `--color-base-100`, but PIE also paints it on
  `--pie-button-active-bg`. Under `valentine`, the direct `--color-base-300` mapping
  left selected picker text at 4.17:1. The active background now keeps 70% of that
  deeper tint and mixes toward `--color-base-100`, the nearest 5% step that clears
  4.5:1 across the shipped DaisyUI themes. The public PIE token and cascade stay the
  same; only the inaccessible provider-derived value is corrected.

  The feedback and boundary corrections go through `legibleColorAgainst`: they
  leave a slot untouched when it already clears its minimum against
  `--color-base-100`; otherwise they use the largest 5% share that passes, mixed
  toward `--color-base-content`. Mixing toward the theme's own text colour borrows
  the theme's guarantee — base-content is what that theme chose to be readable on
  that surface — so one code path lightens a mark in a dark theme and darkens it in
  a light one. Stepping down from the top keeps as much hue as the threshold allows:
  36 of the 84 theme/slot feedback combinations need no correction and keep their
  exact colour.

  `--pie-border-light` is deliberately left alone. It is the token the players use for
  card edges and pane dividers, which 1.4.11 exempts, and a 3:1 outline around every
  item card would be a visual regression rather than a fix. The `-secondary` tints are
  untouched for the same reason: they are fills, and what has to contrast with them is
  the text on top.

  ## Measuring

  Contrast is measured by painting one pixel on a canvas and reading it back. DaisyUI
  5 resolves its palette in `oklch()`, and an oklch-to-sRGB implementation in this
  package would be a second opinion about colours the browser has already decided.

  Where the values are not measurable colours — `mapDaisyThemeToPieVariables` emits
  `var()` references, `bridge.css` is static CSS, and a server render has no canvas —
  the correction falls back to a fixed hue share: 30% for the 4.5:1 targets and 35%
  for the 3:1 ones, each the largest 5% step that clears its threshold for every
  affected slot in all 28 shipped themes. Deliberately pessimistic: a slot that needed
  no correction still gets pulled most of the way to the text colour.

- 647282e: Remove `daisyThemeProviderAdapter` and `registerDaisyThemeProvider`.

  `@pie-players/pie-theme` registers a provider adapter under the id `daisyui` at
  import time, and this package exported a second one under the same id. Now that
  both resolve the same `DAISYUI_PIE_TOKEN_MAP`, they are the same adapter, so
  `registerDaisyThemeProvider()` could only overwrite the built-in with a clone of
  itself — and because `unregisterPieThemeProvider` refuses to drop `daisyui`, there
  was no way back either.

  Nothing was calling them. Hosts using `<pie-theme>` already get the built-in
  adapter; hosts writing variables themselves keep `applyDaisyThemeToElement`,
  `readDaisyThemeTokensFromElement` and the two mappers, which differ from the
  adapter in input shape rather than duplicating it.

  Upgrade note: a host that calls `registerDaisyThemeProvider()` drops the call and
  the import. Importing `@pie-players/pie-theme` registers the same adapter. No
  recorded consumer entrypoint uses either export — one consumer of this package
  imports `bridge.css` only — but that is the one call site an upgrade has to check.

- Updated dependencies [e8a6f0e]
- Updated dependencies [2bcd9fa]
- Updated dependencies [6bbfae1]
- Updated dependencies [1e0c10f]
- Updated dependencies [e8a6f0e]
- Updated dependencies [a4beb70]
- Updated dependencies [1f29de7]
  - @pie-players/pie-theme@0.3.66

## 0.3.65

### Patch Changes

- Updated dependencies [c16c77c]
- Updated dependencies [3f6e33a]
  - @pie-players/pie-theme@0.3.65

## 0.3.64

### Patch Changes

- Updated dependencies [dc44392]
- Updated dependencies [a5241b9]
  - @pie-players/pie-theme@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-theme@0.3.63

## 0.3.62

### Patch Changes

- Updated dependencies [c73c995]
- Updated dependencies [c73c995]
- Updated dependencies [14666b3]
- Updated dependencies [99929d8]
- Updated dependencies [c810459]
  - @pie-players/pie-theme@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-theme@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-theme@0.3.60

## 0.3.59

### Patch Changes

- @pie-players/pie-theme@0.3.59

## 0.3.58

### Patch Changes

- @pie-players/pie-theme@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.56

## 0.3.55

### Patch Changes

- @pie-players/pie-theme@0.3.55

## 0.3.54

### Patch Changes

- @pie-players/pie-theme@0.3.54

## 0.3.53

### Patch Changes

- Updated dependencies [ee6c081]
  - @pie-players/pie-theme@0.3.53

## 0.3.52

### Patch Changes

- @pie-players/pie-theme@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.39

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-theme@0.3.5

## 0.3.4

### Patch Changes

- @pie-players/pie-theme@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-theme@0.3.3

## 0.3.2

### Patch Changes

- @pie-players/pie-theme@0.3.2

## 0.3.1

### Patch Changes

- @pie-players/pie-theme@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/pie-theme@0.3.0

## 0.1.2

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-theme@0.1.2

## 0.1.1

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
