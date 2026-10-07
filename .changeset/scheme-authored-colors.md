---
"@pie-players/pie-theme": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
---

Under a color scheme, `components.css` overrides the colours authored into
content that PIE elements mark (PIE-1119): ink and borders take the scheme's
text and border colours, a near-white fill turns transparent, and any other fill
inverts to the scheme's ink with its content in the scheme's page colour. The
default theme keeps authored colours. Host R, the one host that sets a scheme,
sees authored colours follow it; a host whose own scoped copy sits inside the
scheme root gets the same, one whose scheme root is outside its scope does not.
