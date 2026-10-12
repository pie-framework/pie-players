---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-tts-inline": patch
---

The toolbar and the inline read-aloud tool no longer link Roboto from Google Fonts. NDS icon buttons take Roboto from the stylesheet the NDS button links from `ui.renaissance.com`, which was already in place first on every page that renders one, unless the page links a stylesheet whose URL contains `Roboto`. That CDN serves its font files to Renaissance origins only, so a page elsewhere links its own Roboto.
