# Timed Media Demo Assets

- `water-cycle-lesson.webm`: the timed-media demo's stimulus. A 20-second,
  854x480 slide-deck lesson on the water cycle, generated in this repository by
  [`../../../scripts/generate-timed-media-sample.mjs`](../../../scripts/generate-timed-media-sample.mjs)
  — a canvas animation recorded through `MediaRecorder`. No third-party content
  and no licence to track.

## Why a generated deck rather than real course footage

The demo's job is to show *why* a question appeared. Each cue lands inside the
slide that answers it: the reveal cue at 0:04 fires while "STEP 1 — Evaporation:
the sun heats water in oceans and lakes" is on screen, and the gate cue at 0:10
fires on "STEP 2 — Condensation: water vapour cools and forms clouds". A reviewer
watching the demo sees the cue timeline doing its job instead of taking it on
trust.

Public-domain alternatives were built and compared before this one was chosen —
NASA Goddard SVS 11054 (`Earth's Water Cycle`, narrated, with a real WebVTT
caption file) and SVS 10884 (a global precipitation visualisation). Both are
genuine course-grade material and both lost on the same point: nothing visible in
the frame answers the cue's question, so the demo stops demonstrating the
contract. The narrated NASA excerpt remains the right source for a later demo
covering **captions and transcripts**, which this deck cannot exercise: it has no
speech, so authoring a caption track for it would be inventing content.

## Regenerating

```sh
bun run apps/section-demos/scripts/generate-timed-media-sample.mjs
```

Recording is real-time, so the run takes about as long as the clip. Change a cue
timestamp in `demo-timed-media.ts` and the slide boundaries in the generator
together — they are two halves of one fixture, and a cue that lands between
slides teaches the reader the wrong thing.
