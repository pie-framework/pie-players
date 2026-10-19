# Australian English (en-AU) brief

A delta locale derived from the en-GB run: Australian English follows the
same British spellings, so the catalog shares en-GB's values except where
Australian usage is established and differs, listed below.

## Applied (shared with en-GB)

- colour, centre, minimise/maximise, initialise, maths, anticlockwise,
  centimetres, `alternative` as a noun.
- Learner-facing vocabulary: delivered items read as **Questions**.

## Australian forms that differ from en-GB

- `Graphics Calculator` for the graphing variant (Macquarie and every state
  curriculum authority; en-GB has `Graphic Calculator`): `nameGraphing`,
  `description`, `openedGraphing`, `closedGraphing` under `tools.calculator`.
- `Cartesian plane` for the graph tool's "coordinate plane" (the ACARA term;
  en-GB has `coordinate grid`): `tools.graph.description`,
  `tools.graph.buttonA11y`.

## Notes

- Where Australian and British usage diverge in ways the chrome does not
  surface, the shared British form stands; a host can override per key.
- Plurals match English's CLDR `one`/`other`.
