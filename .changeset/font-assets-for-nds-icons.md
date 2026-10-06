---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-tts-inline": patch
---

The item toolbar and the read-aloud button add Roboto and the `/_fa-pro/`
FontAwesome Pro stylesheets only when they render NDS icon buttons
(`ndsIcons: true`), and request each once per page: a stylesheet that fails to
load is no longer copied into every shadow root. Without `ndsIcons`, on a page
that links no FontAwesome, the toolbar adds no stylesheet and the read-aloud
button adds FA Free alone.
