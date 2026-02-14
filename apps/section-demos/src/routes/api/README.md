# Section Demos API Routes

This directory contains SvelteKit API routes that serve as backend stubs for development and testing.

## Available Endpoints

### Dictionary API
**Route**: `POST /api/dictionary`

Text-based dictionary lookup for word definitions.

**Request**:
```json
{
  "keyword": "triangle",
  "language": "en-us"
}
```

**Response**:
```json
{
  "keyword": "triangle",
  "language": "en-us",
  "definitions": [
    {
      "partOfSpeech": "noun",
      "definition": "A plane figure with three straight sides and three angles.",
      "example": "An equilateral triangle has all sides equal."
    }
  ]
}
```

**Test**:
```bash
curl -X POST http://localhost:5173/api/dictionary \
  -H "Content-Type: application/json" \
  -d '{"keyword":"triangle","language":"en-us"}'
```

---

### Picture Dictionary API
**Route**: `POST /api/picture-dictionary`

Image-based visual dictionary for visual learners and ESL students.

**Request**:
```json
{
  "keyword": "cat",
  "language": "en-us",
  "max": 5
}
```

**Response**:
```json
{
  "images": [
    { "image": "https://..." },
    { "image": "https://..." }
  ]
}
```

**Test**:
```bash
curl -X POST http://localhost:5173/api/picture-dictionary \
  -H "Content-Type: application/json" \
  -d '{"keyword":"cat","language":"en-us","max":5}'
```

**Mock Data Available**:
- `triangle`, `cat`, `apple`, `circle`, `square`
- Unknown keywords return placeholder image

---

### Translation API
**Route**: `POST /api/translation`

Multi-language translation service.

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
  "translatedText": "Hola, ¿cómo estás?",
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

**Supported Mock Translations**:
- English ↔ Spanish
- English ↔ French
- Auto-detect source language
- Unknown translations return placeholder

---

### TTS API
**Routes**:
- `POST /api/tts/synthesize` - Synthesize speech from text
- `GET /api/tts/voices` - Get available voices
- `GET /api/tts/polly/voices` - Get AWS Polly voices
- `GET /api/tts/google/voices` - Get Google Cloud TTS voices

---

### Desmos Calculator Auth
**Route**: `GET /api/tools/desmos/auth`

Returns Desmos API key for calculator tool authentication.

---

## Usage in Code

### Using AnnotationToolbarAPIClient

```typescript
import { AnnotationToolbarAPIClient } from '@pie-players/pie-assessment-toolkit';

// Configure API client
const apiClient = new AnnotationToolbarAPIClient({
  dictionaryEndpoint: '/api/dictionary',
  pictureDictionaryEndpoint: '/api/picture-dictionary',
  translationEndpoint: '/api/translation',
  defaultLanguage: 'en-us'
});

// Dictionary lookup
const dictResult = await apiClient.lookupDictionary('photosynthesis');

// Picture dictionary lookup
const pictureResult = await apiClient.lookupPictureDictionary('triangle', 'en-us', 5);

// Translation
const transResult = await apiClient.translate('Hello', 'es');
```

### Using with Annotation Toolbar Component

```svelte
<script>
import ToolAnnotationToolbar from '@pie-players/pie-tool-annotation-toolbar/tool-annotation-toolbar.svelte';
import { AnnotationToolbarAPIClient } from '@pie-players/pie-assessment-toolkit';

const apiClient = new AnnotationToolbarAPIClient({
  dictionaryEndpoint: '/api/dictionary',
  pictureDictionaryEndpoint: '/api/picture-dictionary',
  translationEndpoint: '/api/translation'
});

async function handleDictionaryLookup({ text }) {
  const result = await apiClient.lookupDictionary(text);
  // Show modal with result.definitions
}

async function handlePictureDictionary({ text }) {
  const result = await apiClient.lookupPictureDictionary(text);
  // Show image gallery with result.images
}

async function handleTranslation({ text }) {
  const result = await apiClient.translate(text, 'es');
  // Show translation modal
}
</script>

<ToolAnnotationToolbar
  enabled={true}
  ttsService={ttsService}
  highlightCoordinator={highlightCoordinator}
  ondictionarylookup={handleDictionaryLookup}
  onpicturedictionarylookup={handlePictureDictionary}
  ontranslationrequest={handleTranslation}
/>
```

---

## Production Configuration (pie-api-aws)

For production deployment, point to pie-api-aws endpoints:

```typescript
const apiClient = new AnnotationToolbarAPIClient({
  dictionaryEndpoint: 'https://api.pie.org/api/dictionary',
  pictureDictionaryEndpoint: 'https://api.pie.org/api/picture-dictionary',
  translationEndpoint: 'https://api.pie.org/api/translation',
  authToken: jwtToken,  // From JWT auth
  organizationId: orgId,
  defaultLanguage: 'en-us'
});
```

## Implementation Status

| Endpoint | Development | Production (pie-api-aws) |
|----------|-------------|-------------------------|
| `/api/dictionary` | ✅ Mock stub | ⚠️ Not yet implemented |
| `/api/picture-dictionary` | ✅ Mock stub | ✅ Implemented (MongoDB + S3) |
| `/api/translation` | ✅ Mock stub | ⚠️ Not yet implemented |

## Adding New Mock Data

### Dictionary
Edit [dictionary/+server.ts](./dictionary/+server.ts):
```typescript
const MOCK_DEFINITIONS: Record<string, any> = {
  yourword: {
    definitions: [...]
  }
};
```

### Picture Dictionary
Edit [picture-dictionary/+server.ts](./picture-dictionary/+server.ts):
```typescript
const MOCK_IMAGES: Record<string, string[]> = {
  yourword: [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg'
  ]
};
```

### Translation
Edit [translation/+server.ts](./translation/+server.ts):
```typescript
const MOCK_TRANSLATIONS: Record<string, Record<string, string>> = {
  'en-es': {
    'your phrase': 'tu frase'
  }
};
```

---

## Notes

- All endpoints support CORS via OPTIONS handler
- Authentication headers are optional in development
- Endpoints return mock data for testing
- Production endpoints require JWT authentication via `Authorization: Bearer {token}` header
