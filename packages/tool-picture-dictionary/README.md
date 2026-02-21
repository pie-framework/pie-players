# Tool Picture Dictionary (`<pie-tool-picture-dictionary>`)

Picture dictionary lookup modal tool used by annotation workflows.

## Purpose

- Owns picture dictionary UX (loading, empty, error, image grid)
- Accepts lookup requests from host/toolbar
- Uses `AnnotationToolbarAPIClient` for backend calls

## Basic usage

```svelte
<pie-tool-picture-dictionary
	requestText={selectedText}
	requestNonce={requestCounter}
	annotationApiClient={annotationApiClient}
/>
```

Increment `requestNonce` each time you want to trigger a new lookup.
