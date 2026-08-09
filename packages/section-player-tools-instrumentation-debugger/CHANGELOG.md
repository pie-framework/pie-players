# @pie-players/pie-section-player-tools-instrumentation-debugger

## 0.3.64

### Patch Changes

- Updated dependencies [9b2f37d]
- Updated dependencies [bb1a90b]
- Updated dependencies [dc44392]
- Updated dependencies [a5241b9]
- Updated dependencies [acee584]
- Updated dependencies [b3acac4]
- Updated dependencies [25511d7]
  - @pie-players/pie-players-shared@0.3.64
  - @pie-players/pie-theme@0.3.64
  - @pie-players/pie-section-player-tools-shared@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-players-shared@0.3.63
- @pie-players/pie-section-player-tools-shared@0.3.63
- @pie-players/pie-theme@0.3.63

## 0.3.62

### Patch Changes

- 27ec7e8: Key the instrumentation debugger list on a panel-assigned record key so colliding record ids can no longer freeze the panel.

  The panel keyed its `{#each}` on `record.id`. Ids are assigned by whoever emitted
  the record, and the panel reads an open `pie-instrumentation-debug-record` window
  event that hosts, demo pages and tests dispatch into directly with hand-written
  ids — those repeat the ids `emitInstrumentationDebugRecord` hands out from its own
  counter, and a synthetic record can arrive with no id at all.

  A repeat threw Svelte's `each_key_duplicate`. Because the throw happens during
  reconciliation, the failure was worse than a logged error: the list stopped
  updating for the rest of the session, so the colliding record and every record
  after it were silently dropped while the panel kept displaying its stale rows. The
  existing e2e coverage passed straight through it — it asserted that a row was
  visible, which was already true before the record was dispatched.

  Each record now gets a monotonic per-panel key on ingest, unique for the panel's
  lifetime including across `clear`, and the list keys and row selection use it
  instead of `id`. Two records that share an id render as two rows, and selecting one
  highlights only that row. Timestamp ties now break on ingest order rather than
  `id`, so an injected record's arbitrary id cannot reorder the list, and a record
  with an unrecognised `kind` is bounded by the global cap instead of escaping the
  per-kind caps.

  The list logic moves to `panel-records.ts` (internal to the package; no export
  surface change) and is covered by unit tests plus an e2e regression test that
  drives the panel with two records sharing an id.

- 99929d8: Move debugger panel styling out of the shared content stylesheet and into the panels that own it.

  `components.css` carried a `SECTION PLAYER DEBUGGER OVERLAYS` block styling the PNP
  and session debugger panels. That file is for authored-content classes no component
  owns, so panel-private rules did not belong in it, and the split was already
  inconsistent: each panel defined most of its own classes locally and left a handful
  behind.

  Those rules now live in each panel's own `<style>` block. The two classes applied by
  `SharedFloatingPanel` rather than by the panel template — the panel root and
  `__content-shell` — are wrapped in `:global()`, since Svelte would otherwise scope
  them to the panel component and they would match nothing.

  Of the 37 classes in the removed block, 14 were referenced nowhere at all
  (`__header*`, `__title`, `__icon-button`, `__icon-xs`, `__resize-*`) — leftovers from
  before `SharedFloatingPanel` renamed those parts to `pie-shared-floating-panel__*`.
  They were deleted rather than relocated.

  Five panels also dropped a `@pie-players/pie-theme/components.css` import that never
  did anything: these packages build with Vite in library mode, so the import was
  extracted to a `dist` CSS file that the built JS never referenced and that no
  `exports` entry exposed — the same defect fixed for `PieItemPlayer.svelte`. Each
  package now ships one fewer dead file.

  If you import `@pie-players/pie-theme/components.css` directly and relied on the
  `pie-section-player-tools-{pnp,session}-debugger*` classes it used to define, they are
  no longer there; they ship with their panel packages instead.

- Updated dependencies [c73c995]
- Updated dependencies [c73c995]
- Updated dependencies [14666b3]
- Updated dependencies [99929d8]
- Updated dependencies [001486e]
- Updated dependencies [6a18f3c]
- Updated dependencies [c810459]
  - @pie-players/pie-theme@0.3.62
  - @pie-players/pie-players-shared@0.3.62
  - @pie-players/pie-section-player-tools-shared@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-players-shared@0.3.61
- @pie-players/pie-section-player-tools-shared@0.3.61
- @pie-players/pie-theme@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-players-shared@0.3.60
- @pie-players/pie-section-player-tools-shared@0.3.60
- @pie-players/pie-theme@0.3.60

## 0.3.59

### Patch Changes

- @pie-players/pie-players-shared@0.3.59
- @pie-players/pie-section-player-tools-shared@0.3.59
- @pie-players/pie-theme@0.3.59

## 0.3.58

### Patch Changes

- Updated dependencies [8df52bf]
- Updated dependencies [d5cc905]
  - @pie-players/pie-players-shared@0.3.58
  - @pie-players/pie-section-player-tools-shared@0.3.58
  - @pie-players/pie-theme@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.57
  - @pie-players/pie-section-player-tools-shared@0.3.57
  - @pie-players/pie-theme@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.56
  - @pie-players/pie-section-player-tools-shared@0.3.56
  - @pie-players/pie-theme@0.3.56

## 0.3.55

### Patch Changes

- Updated dependencies [7f45877]
  - @pie-players/pie-players-shared@0.3.55
  - @pie-players/pie-section-player-tools-shared@0.3.55
  - @pie-players/pie-theme@0.3.55

## 0.3.54

### Patch Changes

- @pie-players/pie-players-shared@0.3.54
- @pie-players/pie-section-player-tools-shared@0.3.54
- @pie-players/pie-theme@0.3.54

## 0.3.53

### Patch Changes

- Updated dependencies [ee6c081]
  - @pie-players/pie-theme@0.3.53
  - @pie-players/pie-section-player-tools-shared@0.3.53
  - @pie-players/pie-players-shared@0.3.53

## 0.3.52

### Patch Changes

- Updated dependencies [017f5a9]
  - @pie-players/pie-players-shared@0.3.52
  - @pie-players/pie-section-player-tools-shared@0.3.52
  - @pie-players/pie-theme@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.51
  - @pie-players/pie-section-player-tools-shared@0.3.51
  - @pie-players/pie-theme@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.50
  - @pie-players/pie-section-player-tools-shared@0.3.50
  - @pie-players/pie-theme@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.49
  - @pie-players/pie-section-player-tools-shared@0.3.49
  - @pie-players/pie-theme@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0c20d0f]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.48
  - @pie-players/pie-section-player-tools-shared@0.3.48
  - @pie-players/pie-theme@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.47
  - @pie-players/pie-section-player-tools-shared@0.3.47
  - @pie-players/pie-theme@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.46
  - @pie-players/pie-section-player-tools-shared@0.3.46
  - @pie-players/pie-theme@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.45
  - @pie-players/pie-section-player-tools-shared@0.3.45
  - @pie-players/pie-theme@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.44
  - @pie-players/pie-section-player-tools-shared@0.3.44
  - @pie-players/pie-theme@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.42
  - @pie-players/pie-section-player-tools-shared@0.3.42
  - @pie-players/pie-theme@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.41
  - @pie-players/pie-section-player-tools-shared@0.3.41
  - @pie-players/pie-theme@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [3a167a8]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.40
  - @pie-players/pie-section-player-tools-shared@0.3.40
  - @pie-players/pie-theme@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.39
  - @pie-players/pie-section-player-tools-shared@0.3.39
  - @pie-players/pie-theme@0.3.39

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [f856362]
- Updated dependencies [c8d46d7]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.38
  - @pie-players/pie-section-player-tools-shared@0.3.38
  - @pie-players/pie-theme@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.37
  - @pie-players/pie-section-player-tools-shared@0.3.37
  - @pie-players/pie-theme@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.36
  - @pie-players/pie-section-player-tools-shared@0.3.36
  - @pie-players/pie-theme@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.35
  - @pie-players/pie-section-player-tools-shared@0.3.35
  - @pie-players/pie-theme@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.34
  - @pie-players/pie-section-player-tools-shared@0.3.34
  - @pie-players/pie-theme@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.33
  - @pie-players/pie-section-player-tools-shared@0.3.33
  - @pie-players/pie-theme@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.32
  - @pie-players/pie-section-player-tools-shared@0.3.32
  - @pie-players/pie-theme@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.31
  - @pie-players/pie-section-player-tools-shared@0.3.31
  - @pie-players/pie-theme@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0981bc3]
- Updated dependencies [698aa82]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.30
  - @pie-players/pie-section-player-tools-shared@0.3.30
  - @pie-players/pie-theme@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.29
  - @pie-players/pie-section-player-tools-shared@0.3.29
  - @pie-players/pie-theme@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.28
  - @pie-players/pie-section-player-tools-shared@0.3.28
  - @pie-players/pie-theme@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.27
  - @pie-players/pie-section-player-tools-shared@0.3.27
  - @pie-players/pie-theme@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.26
  - @pie-players/pie-section-player-tools-shared@0.3.26
  - @pie-players/pie-theme@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-section-player-tools-shared@0.3.25
  - @pie-players/pie-theme@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-section-player-tools-shared@0.3.25
  - @pie-players/pie-theme@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.24
  - @pie-players/pie-section-player-tools-shared@0.3.24
  - @pie-players/pie-theme@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.23
  - @pie-players/pie-section-player-tools-shared@0.3.23
  - @pie-players/pie-theme@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.22
  - @pie-players/pie-section-player-tools-shared@0.3.22
  - @pie-players/pie-theme@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.21
  - @pie-players/pie-section-player-tools-shared@0.3.21
  - @pie-players/pie-theme@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.20
  - @pie-players/pie-section-player-tools-shared@0.3.20
  - @pie-players/pie-theme@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.19
  - @pie-players/pie-section-player-tools-shared@0.3.19
  - @pie-players/pie-theme@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.18
  - @pie-players/pie-section-player-tools-shared@0.3.18
  - @pie-players/pie-theme@0.3.18
