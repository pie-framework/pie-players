# Annotation Toolbar Backend Configuration

The annotation toolbar supports three backend services for enhanced learning features:
- **Dictionary**: Text-based word definitions
- **Picture Dictionary**: Visual image-based vocabulary
- **Translation**: Multi-language translation

## Configuration

### Development (section-demos)

For local development, stub routes are available at:

```typescript
import { AnnotationToolbarAPIClient } from '@pie-players/pie-assessment-toolkit';

const apiClient = new AnnotationToolbarAPIClient({
  dictionaryEndpoint: '/api/dictionary',
  pictureDictionaryEndpoint: '/api/picture-dictionary',
  translationEndpoint: '/api/translation',
  defaultLanguage: 'en-us'
});
```

### Production (pie-api-aws)

For production deployment with pie-api-aws:

```typescript
import { AnnotationToolbarAPIClient } from '@pie-players/pie-assessment-toolkit';

const apiClient = new AnnotationToolbarAPIClient({
  dictionaryEndpoint: 'https://api.pie.org/api/dictionary',
  pictureDictionaryEndpoint: 'https://api.pie.org/api/picture-dictionary',
  translationEndpoint: 'https://api.pie.org/api/translation',
  authToken: 'your-jwt-token',
  organizationId: 'your-org-id',
  defaultLanguage: 'en-us',
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

## API Endpoints

### Dictionary API

**Endpoint**: `POST /api/dictionary`

**Request**:
```json
{
  "keyword": "photosynthesis",
  "language": "en-us"
}
```

**Response**:
```json
{
  "keyword": "photosynthesis",
  "language": "en-us",
  "definitions": [
    {
      "partOfSpeech": "noun",
      "definition": "The process by which green plants use sunlight to synthesize nutrients.",
      "example": "Photosynthesis generates oxygen as a byproduct."
    }
  ]
}
```

### Picture Dictionary API

**Endpoint**: `POST /api/picture-dictionary`

**Request**:
```json
{
  "keyword": "triangle",
  "language": "en-us",
  "max": 5
}
```

**Response**:
```json
{
  "images": [
    { "image": "https://s3.amazonaws.com/bucket/signed-url-1" },
    { "image": "https://s3.amazonaws.com/bucket/signed-url-2" }
  ]
}
```

**Implementation Note**: In pie-api-aws, this endpoint:
- Queries MongoDB `PictureDictionaryKeyModel` by language and keyword
- Returns S3 signed URLs with configurable TTL (default: 48 hours)
- Supports limiting results with `max` parameter

### Translation API

**Endpoint**: `POST /api/translation`

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

## Usage in Components

### With Annotation Toolbar Component

```svelte
<script>
import ToolAnnotationToolbar from '@pie-players/pie-tool-annotation-toolbar';
import { AnnotationToolbarAPIClient } from '@pie-players/pie-assessment-toolkit';

const apiClient = new AnnotationToolbarAPIClient({
  dictionaryEndpoint: '/api/dictionary',
  pictureDictionaryEndpoint: '/api/picture-dictionary',
  translationEndpoint: '/api/translation'
});

async function handleDictionaryLookup({ text }: { text: string }) {
  try {
    const result = await apiClient.lookupDictionary(text);
    // Display dictionary modal with result
    console.log('Dictionary:', result);
  } catch (error) {
    console.error('Dictionary lookup failed:', error);
  }
}

async function handlePictureDictionaryLookup({ text }: { text: string }) {
  try {
    const result = await apiClient.lookupPictureDictionary(text, undefined, 10);
    // Display picture gallery modal with result.images
    console.log('Picture Dictionary:', result);
  } catch (error) {
    console.error('Picture dictionary lookup failed:', error);
  }
}

async function handleTranslationRequest({ text }: { text: string }) {
  try {
    const result = await apiClient.translate(text, 'es'); // Translate to Spanish
    // Display translation modal with result
    console.log('Translation:', result);
  } catch (error) {
    console.error('Translation failed:', error);
  }
}
</script>

<ToolAnnotationToolbar
  enabled={true}
  ttsService={ttsService}
  highlightCoordinator={highlightCoordinator}
  ondictionarylookup={handleDictionaryLookup}
  onpicturedictionarylookup={handlePictureDictionaryLookup}
  ontranslationrequest={handleTranslationRequest}
/>
```

## Environment Variables (pie-api-aws)

For pie-api-aws deployment, configure these environment variables:

```bash
# Picture Dictionary
S3_PICTURE_DICTIONARY_BUCKET=your-bucket-name
MONGODB_URI=mongodb://...

# Translation (if using external service)
TRANSLATION_API_KEY=your-api-key
TRANSLATION_SERVICE=google|aws|custom

# Dictionary (if using external service)
DICTIONARY_API_KEY=your-api-key
DICTIONARY_SERVICE=custom
```

## Implementation Status

| Feature | Development Stub | pie-api-aws Status | Notes |
|---------|-----------------|-------------------|-------|
| Dictionary | ✅ Implemented | ⚠️ Not yet implemented | Stub returns mock definitions |
| Picture Dictionary | ✅ Implemented | ✅ Implemented | Queries MongoDB + S3 signed URLs |
| Translation | ✅ Implemented | ⚠️ Not yet implemented | Stub returns mock translations |

## Adding Backend Implementations

### Dictionary API (pie-api-aws)

To implement the dictionary API in pie-api-aws, create:

1. **Lambda Function**: `functions/dictionary/src/index.ts`
2. **SvelteKit Route**: `containers/pieoneer/src/routes/(jwt)/api/dictionary/+server.ts`
3. **Integration**: External dictionary API (e.g., Merriam-Webster, Oxford)

### Translation API (pie-api-aws)

To implement the translation API in pie-api-aws, create:

1. **Lambda Function**: `functions/translation/src/index.ts`
2. **SvelteKit Route**: `containers/pieoneer/src/routes/(jwt)/api/translation/+server.ts`
3. **Integration**: AWS Translate or Google Cloud Translation API

## Authentication

All endpoints support JWT authentication via the `Authorization` header:

```typescript
const apiClient = new AnnotationToolbarAPIClient({
  // ... endpoints ...
  authToken: jwtToken, // Will send as: Authorization: Bearer {jwtToken}
  organizationId: 'org-123' // Will send as: X-Organization-ID: org-123
});
```

## Testing

To test the stub routes locally:

```bash
# Start section-demos dev server
cd apps/section-demos
bun run dev

# Test dictionary endpoint
curl -X POST http://localhost:5173/api/dictionary \
  -H "Content-Type: application/json" \
  -d '{"keyword":"triangle","language":"en-us"}'

# Test picture dictionary endpoint
curl -X POST http://localhost:5173/api/picture-dictionary \
  -H "Content-Type: application/json" \
  -d '{"keyword":"cat","language":"en-us","max":5}'

# Test translation endpoint
curl -X POST http://localhost:5173/api/translation \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","targetLanguage":"es"}'
```
