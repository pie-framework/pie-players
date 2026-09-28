---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
---

The ruler and protractor import Moveable from
`@pie-players/pie-players-shared/moveable`, which bundles `moveable` and its
dependencies once, so a host that loads both tools gets one copy and installs
nothing for it. `moveable` imports a package it does not declare, which strict
installs such as pnpm `hoist: false` and Yarn PnP cannot resolve from the host.
