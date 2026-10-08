---
"@pie-players/pie-assessment-toolkit": patch
---

The toolkit labels math inside controls with Speech Rule Engine's speech, so a
choice holding 4/12 is named "4 over 12" for screen readers, where browsers
leave its MathML out of the name. English reads ClearSpeak, other languages
MathSpeak. `TTSService.getMathSpeechOptions()` is public.
