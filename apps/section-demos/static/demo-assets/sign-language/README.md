# Sign Language Demo Assets

- `signing-poster.svg`: Authored in-repo as the poster frame for the sign-language
  (ASL) region demo.
- `cdc-asl-handwashing.webm`: A real ASL recording, bundled so the demo and the
  Playwright specs can exercise actual playback rather than a poster frame.

## The clip is a stand-in, not a translation

It does not sign the demo prompts. No public-domain ASL recording signs "A plant
absorbs carbon dioxide and releases oxygen", and inventing one is not something
PIE can do: signed content is produced by signers, and PIE owns neither its
production nor its hosting. So the clip stands in for a translation — it proves
the plumbing (extraction, resolution, PNP gating, region placement, resize,
accessible naming, and that a `<video>` actually decodes and advances), and it
proves nothing about the fidelity of any real signed alternate.

Do not read the demo as an example of authored signed content. Read it as an
example of a signing region that works.

One consequence is worth stating because it is easy to get wrong: **the demo's
questions are chosen so this clip cannot answer them.** A signed alternate is a
translation of the prompt and carries nothing the prompt does not. An earlier
draft of the imported item asked how long to scrub your hands — which the clip
answers, so the "alternate" was handing the learner the key. Any stand-in clip
has to be paired with a question it does not give away, or the demo teaches
something false about what an accommodation is.

## Why not a real signed item

Because none can be committed. Smarter Balanced, Texas STAAR, NJSLA and the
Cambium-run state programs all publish practice tests with embedded ASL video,
and every one keeps the item and the video under state or consortium copyright —
publicly viewable is not licensed. NAEP would be public domain, being a federal
work, but its signing accommodation is a live interpreter, not a video, so there
is no asset. DeafTEC/RIT's ASL-signed math tutorials are free to watch and all
rights reserved. The complete signed items PIE has access to are the Renaissance
bank items, which are secure. Signed items exist wherever items are secure, so a
redistributable one has to be assembled rather than found.

## Provenance

|             |                                                                |
| ----------- | -------------------------------------------------------------- |
| Title       | _ASL Video Series: What You Need to Know About Handwashing_     |
| Author      | Centers for Disease Control and Prevention (CDC)                |
| Via         | [Wikimedia Commons][commons]                                   |
| Status      | Public domain — a work of the U.S. federal government (17 U.S.C. § 105) |
| This file   | The unmodified 240p VP9 transcode Commons generates             |
| Duration    | 2 min 18.75 s, 426 × 240, VP9 + Opus, 2.67 MB                   |
| SHA-256     | `9df900a3d31200b573e83daab0ede438afc70c3df2b6d45dde8fb3c292ba40a6` |

[commons]: https://commons.wikimedia.org/wiki/File:ASL_Video_Series-_What_You_Need_to_Know_About_Handwashing.webm

Public domain carries no attribution requirement. The credit above is here
anyway, because an accessibility asset whose origin nobody can trace is an asset
nobody can responsibly replace.

To re-fetch it byte for byte:

```bash
curl -sL -o cdc-asl-handwashing.webm \
  https://upload.wikimedia.org/wikipedia/commons/transcoded/4/47/ASL_Video_Series-_What_You_Need_to_Know_About_Handwashing.webm/ASL_Video_Series-_What_You_Need_to_Know_About_Handwashing.webm.240p.vp9.webm
```

## Why WebM and why this size

**WebM, not MP4.** Playwright's bundled Chromium ships without the proprietary
codecs, so an H.264 MP4 renders a `<video>` that never loads — and it fails
inside the one spec that asserts playback, where a silent failure is worst. VP9
and Opus are in every Chromium build.

**240p and full length.** 2.67 MB is the smallest whole-work option Commons
offers. A 15-second 480p excerpt would be about 0.9 MB and legibly better for
reading handshapes, but cutting VP9 needs an ffmpeg with the `vp9_superframe`
bitstream filter, which the one Playwright caches does not have (it is built
`--disable-everything`). With a full ffmpeg on `PATH`:

```bash
ffmpeg -i <480p source> -t 15 -c copy -an cdc-asl-handwashing.webm
```
