---
"@pie-players/pie-default-tool-loaders": patch
---

Overlay tools (ruler, protractor, line reader, graph, periodic table, theme, highlighter, dictionaries, answer eliminator and calculator) keep their element across toolbar re-renders, so an open tool no longer loses its position, unit, points or eliminations when the coordinator's policy changes or the interface locale switches.
