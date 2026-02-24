# Section Demos API Routes

This directory contains SvelteKit API routes used by section demos for development/testing.

## Available Endpoints

### Translation API
**Route**: `POST /api/translation`

**Request**:
```json
{
  "text": "Hello, how are you?",
  "sourceLanguage": "auto",
  "targetLanguage": "es"
}
```

**Response**:
```json
{
  "text": "Hello, how are you?",
  "translatedText": "Hola, ¿como estas?",
  "sourceLanguage": "en",
  "targetLanguage": "es"
}
```

**Test**:
```bash
curl -X POST http://localhost:5173/api/translation \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","sourceLanguage":"auto","targetLanguage":"es"}'
```

### TTS API
**Routes**:
- `POST /api/tts/synthesize` - Synthesize speech from text
- `GET /api/tts/voices` - Get available voices
- `GET /api/tts/polly/voices` - Get AWS Polly voices
- `GET /api/tts/google/voices` - Get Google Cloud TTS voices

### Desmos Calculator Auth
**Route**: `GET /api/tools/desmos/auth`

Returns Desmos API key for calculator tool authentication.

## Usage in Code

```typescript
import { AnnotationToolbarAPIClient } from '@pie-players/pie-assessment-toolkit';

const apiClient = new AnnotationToolbarAPIClient({
  translationEndpoint: '/api/translation'
});

const transResult = await apiClient.translate('Hello', 'es');
```

## Notes

- Dictionary and picture dictionary demo APIs have been removed.
- All remaining endpoints support CORS via OPTIONS handler.
