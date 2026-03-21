# Section Demos API Routes

This directory contains SvelteKit API routes used by section demos for development/testing.

## Available Endpoints

### TTS API

**Routes**:

- `POST /api/tts/synthesize` - Synthesize speech from text
- `POST /api/tts/sc` - Proxy SchoolCity-style custom transport synthesis
- `GET /api/tts/voices` - Get available voices
- `GET /api/tts/polly/voices` - Get AWS Polly voices
- `GET /api/tts/google/voices` - Get Google Cloud TTS voices

`/api/tts/*` routes in section-demos implement the PIE transport contract. Custom URL-based
integrations are expected to run through backend translation using `transportMode: "custom"`
at the client provider boundary.

`POST /api/tts/sc` requires server env vars with no defaults:

- `TTS_SCHOOLCITY_URL`
- `TTS_SCHOOLCITY_API_KEY`
- `TTS_SCHOOLCITY_ISS`

### Desmos Calculator Auth

**Route**: `GET /api/tools/desmos/auth`

Returns Desmos API key for calculator tool authentication.

### Session Hydration Demo DB

**Routes**:

- `POST /api/session-demo/bootstrap` - Clear+seed (or clear-only) normalized session tables
- `GET /api/session-demo/state` - Return DB tables and reconstructed section snapshots
- `GET /api/session-demo/snapshot` - Return one section snapshot (`assessmentId`, `sectionId`, `attemptId`)
- `PUT /api/session-demo/snapshot` - Upsert one section snapshot
- `DELETE /api/session-demo/snapshot` - Delete one section snapshot

These endpoints back the `session-hydrate-db` demo and are intentionally lightweight for local use.

## Notes

- Translation, dictionary, and picture dictionary demo APIs have been removed.
- All remaining endpoints support CORS via OPTIONS handler.
