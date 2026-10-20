# British English (en-GB) brief

A delta locale: most values equal `en-US` and that is correct. Only
established, unambiguous British forms change.

## Spelling and vocabulary applied

- `-our`: colour (`tools.theme.buttonA11y` — "change colours and contrast").
- `-re`: centre (`toolkit.window.centerA11y`).
- `-ise`: minimise/maximise (window and panel controls), initialise
  (calculator and TTS init failures, the toolkit init error).
- `maths` for the school subject (`debug.tts.mathHighlighting`).
- `anticlockwise` for counterclockwise rotation
  (`toolkit.placement.rotateCounterclockwiseA11y`).
- `centimetres` (`tools.ruler` unit names in both forms).
- `Graphic Calculator` for the graphing variant (established UK term).
- `coordinate grid` for the graph tool's "coordinate plane"
  (`tools.graph.description`, `tools.graph.buttonA11y`), the UK classroom
  term the tool's own `toolA11y` and `canvasA11y` already use.
- `alternative` as the noun in `tools.signLanguage.description`; "alternate"
  in that sense is North American.
- Learner-facing vocabulary: delivered items read as **Questions**
  (`player.items`, `player.itemsRegionA11y`, the resize-panels label) — UK
  assessment software shows pupils questions, not items.

## Deliberately unchanged

- Product and proper names: PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos,
  Polly, AWS, Google Cloud TTS.
- Units: inches stay (taught alongside centimetres in UK assessment).
- Assessment vocabulary with no established UK-chrome difference (Question,
  Passage, Section, Submit, Check answer).
- Anything uncertain stays identical to `en-US`.

## Notes

- Plurals match English's CLDR `one`/`other`.
- Curly quotes and the `…` ellipsis are kept.
