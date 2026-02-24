# Annotation Toolbar Dialog Components

The demo keeps a single translation dialog for annotation toolbar actions.

## Translation Dialog

**Features:**
- Displays original and translated text
- Shows source/target language
- Includes close controls in header and footer

**State shape:**

```typescript
let translationDialog = $state<{
  open: boolean;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}>({
  open: false,
  originalText: '',
  translatedText: '',
  sourceLanguage: '',
  targetLanguage: ''
});
```

**Open from toolbar callback:**

```typescript
ontranslationrequest={async (detail) => {
  const result = await annotationAPIClient.translate(detail.text, 'es');
  translationDialog = {
    open: true,
    originalText: result.text,
    translatedText: result.translatedText,
    sourceLanguage: result.sourceLanguage,
    targetLanguage: result.targetLanguage
  };
}}
```

## Notes

- Dictionary and picture dictionary dialogs were removed.
