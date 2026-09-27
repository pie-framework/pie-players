---
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
---

The ruler and protractor import `moveable` from the host's `node_modules`, so a
host that loads both bundles one copy. `moveable` 0.53 and its dependencies
import packages they do not declare. npm, Bun and pnpm's default hoisting
resolve them; a pnpm host with `hoist: false` fails to build.
