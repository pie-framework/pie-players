# Annotation Toolbar Backend Configuration

The annotation toolbar backend client now supports translation requests only.

## Client Configuration

```typescript
import { AnnotationToolbarAPIClient } from '@pie-players/pie-assessment-toolkit';

const apiClient = new AnnotationToolbarAPIClient({
  translationEndpoint: '/api/translation',
  authToken: 'your-jwt-token',
  organizationId: 'your-org-id'
});
```

## Translation API

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

## Usage With Annotation Toolbar

```svelte
<script>
import ToolAnnotationToolbar from '@pie-players/pie-tool-annotation-toolbar';
import { AnnotationToolbarAPIClient } from '@pie-players/pie-assessment-toolkit';

const apiClient = new AnnotationToolbarAPIClient({
  translationEndpoint: '/api/translation'
});

async function handleTranslationRequest({ text }: { text: string }) {
  const result = await apiClient.translate(text, 'es');
  console.log('Translation:', result);
}
</script>

<ToolAnnotationToolbar
  enabled={true}
  ttsService={ttsService}
  highlightCoordinator={highlightCoordinator}
  ontranslationrequest={handleTranslationRequest}
/>
```

## Notes

- Dictionary and picture dictionary integrations are removed.
- Include `Authorization`/`X-Organization-ID` headers via client config when needed.
