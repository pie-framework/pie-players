# Pieoneer Integration Guide for New Tools

This document outlines the changes needed in `pie-api-aws/containers/pieoneer` to integrate the new annotation toolbar and other recently added tools.

## Summary of New Tools

From our recent work in `pie-players`:

1. **Annotation Toolbar** - Text highlighting, underlining, with dictionary/translation/TTS features
2. **Touch Event Support** - Mobile/tablet compatibility for annotation toolbar
3. **Translation Protection** - `notranslate` class to prevent UI translation
4. **Calculator Tables Feature** - Data tables in Desmos graphing calculator

## Required Changes in Pieoneer

### 1. Add Missing API Endpoints

Pieoneer currently has `/api/picture-dictionary` but is missing:

#### A. Dictionary Endpoint

**Path:** `containers/pieoneer/src/routes/(jwt)/api/dictionary/+server.ts`

```typescript
import { json, error, type RequestHandler } from '@sveltejs/kit';
// TODO: Import dictionary service from @pie-api-aws/services if available
// For now, can use stub implementation or AWS Bedrock translation

const DEFAULT_LANGUAGE = 'en-us';

/**
 * Dictionary API - Word definitions lookup
 *
 * Request Body (POST JSON):
 *   {
 *     keyword: string,      // Required - Word to look up
 *     language?: string     // Optional - Language code (default: 'en-us')
 *   }
 *
 * Returns:
 *   {
 *     keyword: string,
 *     language: string,
 *     definitions: [
 *       {
 *         partOfSpeech: string,  // e.g., "noun", "verb"
 *         definition: string,
 *         example?: string
 *       }
 *     ]
 *   }
 */

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { keyword, language = DEFAULT_LANGUAGE } = body;

  if (!keyword) {
    error(400, 'Missing required parameter: keyword');
  }

  try {
    console.log('[dictionary] Looking up word:', { keyword, language });

    // TODO: Integrate with actual dictionary service
    // Options:
    // 1. AWS Bedrock for AI-powered definitions
    // 2. External dictionary API (Oxford, Merriam-Webster)
    // 3. Pre-populated dictionary database

    // Stub response for now:
    return json({
      keyword,
      language,
      definitions: [{
        partOfSpeech: 'noun',
        definition: `Definition for "${keyword}" (dictionary service not yet configured)`,
        example: `This is a placeholder definition.`
      }]
    });
  } catch (e: any) {
    console.error(`[dictionary] Failed to look up word "${keyword}":`, e);
    error(500, `Failed to look up word: ${e.message}`);
  }
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
```

#### B. Translation Endpoint

**Path:** `containers/pieoneer/src/routes/(jwt)/api/translation/+server.ts`

```typescript
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { bedrockTranslate } from '@pie-api-aws/bedrock'; // If available

const DEFAULT_SOURCE_LANGUAGE = 'auto';

/**
 * Translation API - Text translation
 *
 * Request Body (POST JSON):
 *   {
 *     text: string,              // Required - Text to translate
 *     targetLanguage: string,    // Required - Target language code
 *     sourceLanguage?: string    // Optional - Source language (default: 'auto')
 *   }
 *
 * Returns:
 *   {
 *     text: string,              // Original text
 *     translatedText: string,    // Translated text
 *     sourceLanguage: string,    // Detected or specified source language
 *     targetLanguage: string     // Target language
 *   }
 */

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { text, sourceLanguage = DEFAULT_SOURCE_LANGUAGE, targetLanguage } = body;

  if (!text) {
    error(400, 'Missing required parameter: text');
  }
  if (!targetLanguage) {
    error(400, 'Missing required parameter: targetLanguage');
  }

  try {
    console.log('[translation] Translating text:', {
      textLength: text.length,
      sourceLanguage,
      targetLanguage
    });

    // Use AWS Bedrock for translation
    const result = await bedrockTranslate({
      text,
      sourceLanguage: sourceLanguage === 'auto' ? undefined : sourceLanguage,
      targetLanguage
    });

    return json({
      text,
      translatedText: result.translatedText,
      sourceLanguage: result.detectedSourceLanguage || sourceLanguage,
      targetLanguage
    });
  } catch (e: any) {
    console.error('[translation] Translation failed:', e);
    error(500, `Translation failed: ${e.message}`);
  }
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
```

### 2. Update ToolkitCoordinator Configuration

**File:** `containers/pieoneer/src/routes/(fullscreen)/section-preview/[activityDefinitionId]/[sectionId]/+page.svelte`

**Current Configuration:**
```typescript
toolkitCoordinator = new ToolkitCoordinator({
  assessmentId: `pieoneer-${data.activityDefinitionId}`,
  tools: {
    tts: { enabled: true },
    answerEliminator: { enabled: true },
    floatingTools: {
      calculator: {
        enabled: true,
        provider: 'desmos',
        authFetcher: async () => {
          const response = await fetch('/api/tools/desmos/auth');
          return response.json();
        }
      }
    }
  }
});
```

**Updated Configuration (add annotation toolbar):**
```typescript
toolkitCoordinator = new ToolkitCoordinator({
  assessmentId: `pieoneer-${data.activityDefinitionId}`,
  tools: {
    tts: { enabled: true },
    answerEliminator: { enabled: true },
    annotationToolbar: {
      enabled: true,
      apiEndpoints: {
        dictionary: '/api/dictionary',
        pictureDictionary: '/api/picture-dictionary',
        translation: '/api/translation'
      }
    },
    floatingTools: {
      calculator: {
        enabled: true,
        provider: 'desmos',
        authFetcher: async () => {
          const response = await fetch('/api/tools/desmos/auth');
          return response.json();
        }
      }
    }
  }
});
```

### 3. Optional: Add PNP Profile Support for Annotation Toolbar

The annotation toolbar should be included in the PNP (Personal Needs Profile) tool registry for accessibility configurations.

**File:** Update the tool registry in assessment-toolkit if not already included

The annotation toolbar automatically appears when:
- User selects text (if enabled)
- PNP profile specifies annotation tool requirements

### 4. Environment Variables (if using external services)

Add to `.env` or deployment configuration:

```bash
# Dictionary service (if using external API)
DICTIONARY_API_KEY=your_api_key_here
DICTIONARY_API_URL=https://api.dictionaryapi.dev/api/v2/entries

# AWS Bedrock for translation (if using AWS Translate)
AWS_BEDROCK_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=amazon.translate-v1

# Existing picture dictionary config
S3_PICTURE_DICTIONARY_BUCKET=your-bucket-name
```

### 5. Testing the Integration

Once integrated, test each feature:

#### A. Annotation Toolbar
1. Load section preview
2. Select text in an item
3. Verify toolbar appears with:
   - 4 highlight colors (yellow, pink, blue, green)
   - Underline button
   - TTS button
   - Dictionary button
   - Picture dictionary button
   - Translation button
   - Remove button (if text already highlighted)
   - Clear all button

#### B. Touch Events (Mobile)
1. Open preview on tablet/iPad
2. Touch-select text
3. Verify toolbar appears and works with touch

#### C. Dictionary
1. Select a word
2. Click dictionary icon
3. Verify modal shows definitions with:
   - Part of speech
   - Definition text
   - Example usage

#### D. Translation
1. Select text
2. Click translation icon
3. Select target language
4. Verify translation appears in modal

#### E. Picture Dictionary
1. Select a noun (e.g., "cat", "car")
2. Click picture dictionary icon
3. Verify image grid displays

## Additional Notes

### Backend Service Options

For **Dictionary**:
- **Option 1:** AWS Bedrock with Claude (AI-powered definitions)
- **Option 2:** Free Dictionary API (https://dictionaryapi.dev/)
- **Option 3:** Oxford/Merriam-Webster API (requires subscription)
- **Option 4:** Pre-populated dictionary database in DynamoDB

For **Translation**:
- **Option 1:** AWS Bedrock Translate (recommended, already in stack)
- **Option 2:** AWS Translate service
- **Option 3:** Google Translate API

### Security Considerations

1. **Rate Limiting:** Add rate limits to prevent API abuse
2. **Authentication:** All endpoints are under `(jwt)` route group - JWT required
3. **Input Validation:** Sanitize keyword/text inputs
4. **Cost Controls:** Monitor AWS Bedrock usage for translation

### Accessibility

The annotation toolbar includes:
- Full keyboard navigation
- ARIA labels on all buttons
- Screen reader announcements for actions
- High contrast color swatches
- Touch/mobile support

### Translation Protection

Tools now include `notranslate` class and `translate="no"` attribute to prevent:
- Calculator symbols from being translated
- Toolbar UI from being translated
- Math notation from being mangled by translation tools

This prevents confusion when users enable browser/system-wide translation.

## Migration Checklist

- [ ] Add `/api/dictionary` endpoint
- [ ] Add `/api/translation` endpoint
- [ ] Verify `/api/picture-dictionary` still works
- [ ] Update ToolkitCoordinator config in section preview
- [ ] Update ToolkitCoordinator config in activity preview (if different)
- [ ] Add environment variables for external services
- [ ] Test annotation toolbar in preview
- [ ] Test on mobile/tablet devices
- [ ] Test dictionary lookups
- [ ] Test translation
- [ ] Test picture dictionary
- [ ] Verify translation protection (notranslate classes work)
- [ ] Add rate limiting to new endpoints
- [ ] Monitor AWS costs (if using Bedrock)
- [ ] Update documentation for content creators

## Questions/Decisions Needed

1. **Dictionary Service:** Which dictionary service should we use?
   - Recommendation: Start with AWS Bedrock (Claude) for AI-powered definitions, then optionally add dedicated dictionary API for better accuracy

2. **Translation Service:** Confirm AWS Bedrock is preferred over AWS Translate?
   - AWS Bedrock: More flexible, supports context-aware translation
   - AWS Translate: Faster, cheaper, purpose-built

3. **Default Languages:** What languages should be supported?
   - Currently using 'en-us' as default
   - Need full list of supported language codes

4. **PNP Integration:** Should annotation toolbar be:
   - Always available? (current default)
   - Only available via PNP profile?
   - Configurable per assessment?

## References

- [Annotation Toolbar Backend Config](./annotation-toolbar-backend-config.md)
- [Annotation Toolbar Dialogs](./annotation-toolbar-dialogs.md)
- [sc-online-testing Integration History](../README.md) - Original implementation reference
