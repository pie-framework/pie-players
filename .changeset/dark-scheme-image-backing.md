---
"@pie-players/pie-theme": patch
---

Images in item content get a white backing when the page's `color-scheme` is dark, so black artwork on a transparent background stays visible (PIE-1554); the answer eliminator's image casing turns dark over it. `<pie-theme>` and the generated `tokens.css` now state `color-scheme: dark` for the dark Base Theme, and `color-schemes.css` states each built-in's polarity, so native controls follow those pages too. Host A gets the backing and dark native controls when its dark theme is selected. Hosts R and S get the backing under the dark schemes, and Host R also under its DaisyUI dark themes, which declare `color-scheme: dark` themselves.
