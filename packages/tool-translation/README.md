# Tool Translation (`<pie-tool-translation>`)

Translation modal tool used by annotation workflows.

## Purpose

- Owns translation UX (loading, error, source/target display)
- Accepts translation requests from host/toolbar
- Uses `AnnotationToolbarAPIClient` for backend calls

## Basic usage

```svelte
<pie-tool-translation
	requestText={selectedText}
	requestNonce={requestCounter}
	targetLanguage="es"
	annotationApiClient={annotationApiClient}
/>
```

Increment `requestNonce` each time you want to trigger a new lookup.
