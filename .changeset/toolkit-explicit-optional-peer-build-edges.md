---
"@pie-players/pie-assessment-toolkit": patch
---

Declare the toolkit's two optional peer packages as devDependencies so the build graph orders them before its own `tsc`.

`assessment-toolkit` type-imports `@pie-players/pie-calculator-desmos` and
`@pie-players/tts-client-server` at the dynamic-import sites in
`DesmosToolProvider` and `TTSToolProvider`. Both were declared only as optional
`peerDependencies`, which states the consumer contract but is not a build-graph
edge: only `dependencies` and `devDependencies` order one workspace package's
build after another's.

turbo 2.9 happened to derive task-graph edges from `peerDependencies` too, so the
ordering held by accident. turbo 2.10 stopped, turning the toolkit's build into a
race against those two packages that fails whenever its own `tsc` wins:

```
src/services/tool-providers/DesmosToolProvider.ts(135,34): error TS2307:
  Cannot find module '@pie-players/pie-calculator-desmos'
```

Both packages are now also devDependencies, so the ordering is explicit and holds
under either turbo version. The `peerDependencies` and `peerDependenciesMeta`
entries are unchanged, so consumers still see both as optional peers, and the
runtime load path is untouched. A standalone build of just this package in a fresh
checkout now works too.

`check:deps` grew a `workspace-build-edge` rule that fails when a package imports a
workspace package it declares only as a peer or optional dependency, so this cannot
regress silently.
