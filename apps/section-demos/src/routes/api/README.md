# Section Demos API Routes

This directory contains SvelteKit API routes used by section demos for development/testing.

## Available Endpoints

### TTS API

**Routes**:

- `POST /api/tts/synthesize` - Synthesize speech from text
- `GET /api/tts/voices` - Get available voices
- `GET /api/tts/polly/voices` - Get AWS Polly voices
- `GET /api/tts/google/voices` - Get Google Cloud TTS voices

### Desmos Calculator Auth

**Route**: `GET /api/tools/desmos/auth`

Returns Desmos API key for calculator tool authentication.

## Notes

- Translation, dictionary, and picture dictionary demo APIs have been removed.
- All remaining endpoints support CORS via OPTIONS handler.
