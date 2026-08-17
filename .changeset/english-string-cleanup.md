---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-ruler": patch
---

Reword sixteen English interface strings that the i18n adoption deliberately
carried over unchanged, and settle one naming rule for the nine toolbar tool
buttons.

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
  `tools.ruler.applicationA11y` carries the same instruction and gets the same
  treatment.
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

## Toolbar button accessible names

Every toolbar tool button is a toggle: the toolbar mirrors its active state onto
the button as `aria-pressed`. Two of the nine names contradicted that by naming an
action — "Open ruler tool" announced as "Open ruler tool, toggle button, pressed"
once the ruler was open. The rest used a `Name - Description` form whose hyphen a
screen reader renders as an unpredictable pause, and two of them collided outright:
`tools.highlighter` and `tools.annotationToolbar` both resolved to "Highlight
text" for different buttons.

All nine now follow one rule. The name contains the button's visible tooltip
verbatim, per WCAG 2.5.3 Label in Name, and adds a comma-separated purpose clause
only where the tooltip alone does not identify the tool — so "Ruler" and
"Protractor" stand alone, while "Theme" becomes "Theme, change colors and
contrast". No name encodes an action, because the pressed state already carries it.
`tools.answerEliminator.buttonA11y` previously did not contain its own tooltip
("Strike Through") at all, which is the 2.5.3 failure rather than a style
preference.

`tools.annotationToolbar.tooltip` changes from "Highlight" to "Annotate": two
toolbar buttons carrying the same *visible* label is a defect, and this tool also
underlines, removes and clears.

The calculator's name no longer swaps between "Open …" and "Close …" as it opens.
Three unlocalized strings surfaced while making that change, all of them built by
splicing a raw type token into an English template, and all of them rendered:
`Close ${name.toLowerCase()}` as the toolbar button's tooltip, `Close ${type}
calculator` as the inline calculator's tooltip, and `${type} calculator opened`
in the inline calculator's live region. All three now resolve from the catalog,
which gains a name and two announcements for each of the three variants the Desmos
provider implements — including `graphing`, which the inline element accepts from
its host and which the old template rendered while the catalog had no key for it —
and drops the six open/close keys the swap needed.

## nl-NL

The rewordings above leave it alone: a translation was never obliged to reproduce
an English flaw, and it already rendered the protractor's help without the
Moveable.js clause. The button naming rule is not an English matter, so all nine
Dutch `buttonA11y` values move with their English counterparts, and
`tools.annotationToolbar.tooltip` becomes "Aantekenen" for the same reason it
becomes "Annotate". Both catalogs stay complete.

## Downstream impact

This is the only part of the interface-locale work that changes what a host
renders with no `locale` supplied. Host A is the affected consumer — it drives
live delivery with the toolbar placed — and Host R renders the same buttons.
Neither asserts, styles, nor selects on any of the retired strings, so the
exposure is screen-reader output only. See `docs/integrations/consumer-api-dependencies.md`.
