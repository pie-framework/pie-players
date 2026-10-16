---
"@pie-players/pie-context": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-item-player": patch
---

The toolkit's `autoplayAudio` decision reaches the item player: `<pie-item-scope>` provides it as `itemFeatureDecisionsContext`, and the item player writes a hold as `autoplayAudioHeld: true` and a grant as `autoplayAudioEnabled: true` onto the delivery models, then announces `feature-decision-applied` (`{ featureId, granted, rule, overrode? }`, once per feature). In view mode the item player removes `autoplay` attributes from item and passage markup, under `trust-markup` and a host `sanitizeMarkup` too, so audio and video start only through the model setting. `tools.policy.allowed` and `tools.policy.blocked` accept `autoplayAudio`. The `autoplay-audio-enabled` attribute no longer applies in author mode.
