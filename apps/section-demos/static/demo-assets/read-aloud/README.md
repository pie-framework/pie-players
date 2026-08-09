# Read-Aloud Demo Assets

- `photosynthesis-prompt.wav`, `chloroplast-prompt.wav`: narration for the
  recorded-audio items in the read-aloud accommodations demo.

## These are synthesized, not human recordings

Both clips are macOS `say` output (the `Samantha` voice), converted to 16-bit PCM
WAV. Regenerate with:

```bash
say -v Samantha -o /tmp/p.aiff "A plant absorbs carbon dioxide and releases oxygen. What is this process called?"
afconvert -f WAVE -d LEI16@22050 -c 1 /tmp/p.aiff photosynthesis-prompt.wav
```

That is a slightly odd thing to bundle for a feature whose whole point is *not*
using synthesized speech, so it is worth being clear about what the clips prove
and what they do not.

They prove the path: that a `spoken` card carrying a file plays that file instead
of synthesizing, that the docked node highlights as a block for the clip's
duration, that a time range is honoured, that the rate control reaches
`playbackRate`, and that a clip which fails to load degrades to the reading
script. None of that depends on who or what produced the audio.

They prove nothing about the accommodation's value. A program adopting recorded
audio does so because a human voice reads better than a synthesizer — for
pacing, for emphasis, for names and numbers a TTS engine mangles. No file PIE can
generate demonstrates that, and a real narration would have to be commissioned
and licensed, which is host-owned work. So the clips stand in, the same way the
signing demo's clip stands in for a translation.

## WAV, not MP3

Playwright's bundled Chromium ships without the proprietary codecs, so an MP3 or
AAC clip would be a file the very test that asserts playback could never decode.
WAV and Ogg are the safe formats here. The signing demo bundles WebM rather than
MP4 for the same reason.

The uncompressed cost is about 360 KB for the pair. Small next to the 2.7 MB
signing clip, and worth more than a smaller file that silently fails in CI.

## `missing-on-purpose.wav` is missing on purpose

The fourth demo item points a card at that filename and there is no such file.
That item exists to make the fallback observable — read-aloud speaks the script
instead — so creating the file would delete the thing it demonstrates. If a
future asset sweep "fixes" the broken link, the demo stops testing anything.
