---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-ruler": patch
---

Reword fifteen English interface strings that the i18n adoption deliberately
carried over unchanged.

Adopting the interface locale held English byte-identical on purpose, so that a
host who opted into nothing saw exactly the chrome they already had and no text
change hid inside a refactor. That left a set of strings keyed but not fixed. This
is that follow-up, and it is a text change with nothing else in it.

Most of them are accessible names, which is why they are worth the entry: a screen
reader reads them aloud, and a host may be asserting the exact string.

- `tools.protractor.toolA11y` no longer ends "Current rotation displayed via
  Moveable.js". A learner does not need the name of the drag library, and the
  clause said nothing about how to use the tool. The keyboard instructions in
  front of it are unchanged apart from `PageUp/PageDown` becoming "PageUp or
  PageDown", which a screen reader reads as words rather than a path.
- `tools.graph.toolA11y`, `tools.graph.canvasA11y` and
  `tools.periodicTable.toolA11y` were Title Case with a hyphen standing in for a
  break ("Graph Tool - Draw points and lines…"). Now sentence case with an em
  dash. The periodic table's also said "Click elements", which excludes keyboard
  and touch, and now reads "select an element to view its details".
- `tools.textToSpeech.toolA11y` was "Text-to-Speech Tool", now "Text-to-speech
  tool", matching every other `toolA11y`.
- The four `tools.graph.mode*Hint` strings capitalised the word after the colon
  ("Point: Click on the grid"). Now lowercase, as running text.
- Five `debug.tts.*` messages spelled the abbreviation "TTS" at a learner. They
  now say "text-to-speech", or drop the word where the surrounding sentence
  already establishes it.
- `debug.liveUpdatesDisconnected` and `debug.tts.applying` used three ASCII dots
  where `common.loading` uses an ellipsis. Now consistent.

One key pair is removed rather than reworded. `tools.ruler` carried three forms of
each unit name because the pre-adoption code rendered three: Title Case on the
button, lowercase in the announcement, and the raw `'inches' | 'cm'` state token in
the accessible name and the image alt — so the same tool said "inches" for one unit
and "cm" for the other, in a string a screen reader speaks as two letters. The
abbreviation pair is gone and both of those now interpolate the spelled-out
in-sentence form, leaving two forms per unit instead of three.

`nl-NL` is unaffected except for the two removed keys: a translation was never
obliged to reproduce an English flaw, and it already rendered the protractor's help
without the Moveable.js clause.
