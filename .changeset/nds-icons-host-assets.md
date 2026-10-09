---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-tts-inline": patch
---

With `ndsIcons` on a page that links no Font Awesome Pro, the toolbar's calculator button and the calculator window's controls render in Font Awesome Free Solid; they rendered blank or as boxes before. The toolbar and the read-aloud button no longer request `/_fa-pro/` stylesheets, which only the section demos serve.
