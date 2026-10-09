---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

A section whose readiness is met before its controller resolves now reaches the `interactive` stage when the controller resolves. It stopped at `engine-ready`, since no later readiness change arrived to move it on. Preloaded elements make that order likely: their items load in the same flush as the section's composition.
