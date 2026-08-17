---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-player": patch
---

Give `pie-assessment-player-default` an interface locale.

The adoption pass covered the item player, the section players and the toolkit,
and left the assessment player out: it rendered its own section-to-section
navigation from four English literals — "Section {n} of {total}", "No sections",
"Back" and "Next" — and forwarded no locale to the section element it mounts, so a
host that set one got translated section chrome inside an untranslated assessment
frame.

It now observes a `locale` attribute, resolves its own provider, and forwards the
tag to the section element. Its own provider rather than a context read, because
the navigation sits beside the section host rather than inside it, so there is no
published toolkit context above it. The catalog gains
`player.assessment.sectionPosition` and `player.assessment.noSections`; the two
buttons take the `common.back` / `common.next` that already existed.

Additive and default-English: with no `locale` the provider stays on `en-US` and
the four strings render exactly what they rendered before, and the section element
gets no `locale` attribute rather than an empty one, which it would otherwise try
to resolve.
