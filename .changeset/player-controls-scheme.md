---
"@pie-players/pie-theme": patch
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
---

The assessment Back and Next buttons, the graph tool's grid slider, the ruler and protractor graphics and the tool window's resize grip now follow the color scheme, where they kept the browser's defaults, black marks on a white plate or a black alpha that vanished on dark schemes (PIE-1578); under the default theme the navigation buttons' border turns from `#d1d1d1` to `#8f8f8f` and their text to `#374151`, the slider from the browser's blue to `#3f51b5`, and the grip from 35% black to `#646464`. `--pie-scrim` is a new public token for a modal backdrop, which every scheme sets to the TTS settings backdrop's existing `rgba(0, 0, 0, 0.3)`.
