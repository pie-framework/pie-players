# Tool Dictionary (`<pie-tool-dictionary>`)

Dictionary lookup modal tool used by annotation workflows.

## Purpose

- Owns dictionary lookup UX (loading, empty, error, results)
- Accepts lookup requests from host/toolbar
- Uses `AnnotationToolbarAPIClient` for backend calls

## Basic usage

```svelte
<pie-tool-dictionary
	requestText={selectedText}
	requestNonce={requestCounter}
	annotationApiClient={annotationApiClient}
/>
```

Increment `requestNonce` each time you want to trigger a new lookup.
