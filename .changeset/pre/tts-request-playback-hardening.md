---
"@pie-players/tts-client-server": patch
---

Keep synthesis failures status-only in errors, logs and telemetry, and release failed response streams without waiting for their bodies. Settle stopped or superseded playback and release audio URLs when playback fails. Preserve pause and resume during synthesis and buffering. Hosts configuring server text-to-speech retain their request and telemetry shapes; provider-supplied failure text is replaced by sanitized messages that keep standard error names such as `NotAllowedError`.
