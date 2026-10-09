---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

After a section switch, the new section's subscriptions receive `content-loaded` and `section-loading-complete` for its own renderables only, where the previous section's loads used to be replayed into it. The section player's `pie-loading-complete` fires when the new section's elements are ready rather than at the switch.
