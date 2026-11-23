---
"@pie-players/pie-theme": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-annotation-toolbar": patch
---

The five annotation highlight fills are registered theme tokens that both base themes and every color scheme set by polarity, so a dark scheme paints dark fills whatever the operating system prefers and every fill holds 4.5:1 under the scheme's text (PIE-1577). The toolbar swatches paint those same fills and are paler than before, the light fills are now opaque, and a system request for more contrast no longer saturates them; Hosts R and S see all three, and a host that registers its own dark scheme sets the five or inherits the light fills.
