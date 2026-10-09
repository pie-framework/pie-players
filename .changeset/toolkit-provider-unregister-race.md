---
"@pie-players/pie-assessment-toolkit": patch
---

A tool disabled and re-enabled while its provider is still starting keeps the new provider instead of losing it. A section whose controller fails to start no longer leaves the previous section's controller handling persist and hydrate.
