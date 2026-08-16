---
"@pie-players/tts-server-sc": patch
---

Report the SchoolCity TTS locale roster from `getVoices()`.

It returned an empty array. The service serves 29 locales with one default Polly
voice each, and `SynthesizeRequest.voice` was already plumbed through to it, so
the missing piece was never selection — it was discovery. With no roster, those
locales were reachable only by a caller that already knew a `lang_id` to
hardcode, which is the substance of PIE-479.

The roster is a table transcribed from the map the service reads
(`sc-texttospeech-api` - `src/helpers/voices.js`), not a lookup. The service's
whole surface is `GET /ping` and an authenticated `POST /`, so there is nothing
to query; the trade is that the table goes stale silently if the service adds a
locale, and in exchange every entry is traceable to one upstream line and
`getVoices()` costs no request and needs no credential. Only the default voice
per locale is listed — the service forwards any `VoiceId` Polly knows, and
`voices.js` names alternates in trailing comments, but those are hand-maintained
annotations rather than the map the service actually reads.

`language` is a language range matched per RFC 4647 basic filtering, so `en`
reaches every English locale and `en-GB` reaches `en-GB-WLS`. Gender is set only
where the upstream map records it, which leaves `arb` and `cmn-CN` out of a
gender-filtered query rather than asserting a fact their source does not carry.

Also exported without a provider instance — `schoolCityVoices`,
`SCHOOLCITY_DEFAULT_VOICES`, `defaultVoiceForSchoolCityLanguage` and
`isSupportedSchoolCityLanguage`. That last one matters more than it looks: an
unrecognized `lang_id` is not an upstream error, it is rewritten to `en-US`, so
an unserved locale returns English audio and no failure. A caller that wants to
know has to check locally.

Purely additive. Nothing in the repository consumed this provider's `getVoices()`
before, so no existing caller changes behavior.
