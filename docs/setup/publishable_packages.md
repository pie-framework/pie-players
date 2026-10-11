# Publishable Packages Inventory

This is the maintainers' list of the `@pie-players/*` packages in the lockstep
release set, which release together at one version. The `fixed` block in
`.changeset/config.json` is the source of truth for membership; the list below
repeats it in the same order, and `check:docs:publishable-packages` fails when
the two differ. Hosts choosing what to install read
[Packages and entry points](../install/packages.md), which groups the packages
by job and entry point.

Before a release, `check:pack-integrity:real` (`scripts/check-pack-integrity.mjs`,
run by `verify:publish`) checks every package's packed tarball. Releases are
patch-only while the packages are on `0.x.y`
([versioning policy](./publishing.md#versioning-policy)).

`@pie-players/pie-tool-theme` is the color-scheme tool (`theme`).
`@pie-players/pie-preloaded-player` is the one published package outside this
set: `publish-preloaded-player.yml` publishes it, versioned
`<loaderVersion>-<set>.<iteration>`
([version scheme](../preloaded-player/readme.md#version-scheme)).

Publishable packages:

- `@pie-players/pie-assessment-player`
- `@pie-players/pie-assessment-toolkit`
- `@pie-players/pie-calculator`
- `@pie-players/pie-calculator-cortex`
- `@pie-players/pie-calculator-desmos`
- `@pie-players/pie-calculator-geogebra`
- `@pie-players/pie-context`
- `@pie-players/pie-default-tool-loaders`
- `@pie-players/pie-item-player`
- `@pie-players/pie-players-shared`
- `@pie-players/pie-print-player`
- `@pie-players/pie-section-player`
- `@pie-players/pie-section-player-tools-event-debugger`
- `@pie-players/pie-section-player-tools-instrumentation-debugger`
- `@pie-players/pie-section-player-tools-pnp-debugger`
- `@pie-players/pie-section-player-tools-session-debugger`
- `@pie-players/pie-section-player-tools-tts-settings`
- `@pie-players/pie-section-player-tools-shared`
- `@pie-players/pie-theme`
- `@pie-players/pie-tool-annotation-toolbar`
- `@pie-players/pie-tool-answer-eliminator`
- `@pie-players/pie-tool-calculator-desmos`
- `@pie-players/pie-tool-calculator-inline-desmos`
- `@pie-players/pie-tool-calculator-shared`
- `@pie-players/pie-tool-dictionary`
- `@pie-players/pie-tool-picture-dictionary`
- `@pie-players/pie-tool-theme`
- `@pie-players/pie-tool-graph`
- `@pie-players/pie-tool-line-reader`
- `@pie-players/pie-tool-periodic-table`
- `@pie-players/pie-tool-protractor`
- `@pie-players/pie-tool-ruler`
- `@pie-players/pie-tool-sign-language`
- `@pie-players/pie-tool-tts-inline`
- `@pie-players/pie-tts`
- `@pie-players/tts-client-server`
- `@pie-players/tts-server-core`
- `@pie-players/tts-server-google`
- `@pie-players/tts-server-polly`
- `@pie-players/tts-server-sc`
