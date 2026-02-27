# Authoring Mode - Implementation Guide

## Overview

The pie-players project now supports **authoring mode** for editing PIE items. This enables:
- Item-level editing using configure elements from pie-elements
- Real-time model updates via event handling
- Toggle between authoring and preview modes
- Asset upload support (images/sounds)
- Backward compatible API with existing view modes

## Architecture

### Bundle Types

PIE elements support three bundle types:

1. **`player.js`** - Elements only (for hosted/server-processed models)
2. **`client-player.js`** - Elements + controllers (for client-side rendering)
3. **`editor.js`** - Configure elements for authoring (NEW)

When `mode='author'`, the players load `editor.js` bundles which contain configure elements with the `-config` suffix.

### Configure Elements

Configure elements are the authoring counterparts to player elements:

```typescript
// Player element (student view)
<multiple-choice-element id="Q124"></multiple-choice-element>

// Configure element (authoring view)
<multiple-choice-element-config id="Q124"></multiple-choice-element-config>
```

Configure elements:
- Accept `model` and `configuration` properties
- Emit `model.updated` events when the user makes changes
- Provide authoring UI (forms, editors, settings panels)

### Type System

```typescript
// Player modes (extended)
type PlayerMode = 'gather' | 'view' | 'evaluate' | 'author';

// Authoring environment
interface AuthoringEnv extends Env {
  mode: 'author';
  configuration?: Record<string, any>;
}

// Configure element interface
interface ConfigureElement extends HTMLElement {
  model: any;
  configuration: any;
}

// Asset handler interface
interface AssetHandler {
  cancel: () => void;
  done: (err?: Error, src?: string) => void;
  fileChosen: (file: File) => void;
  progress?: (percent: number, bytes: number, total: number) => void;
}
```

### Configuration Object

The `configuration` prop controls what authoring features are available:

```typescript
{
  '@pie-element/multiple-choice': {
    // Element-specific configuration
    // Controls which authoring features are enabled
  }
}
```

## Using Authoring Mode

### pie-iife-player

```html
<pie-iife-player
  config='{"elements": {...}, "models": [...], "markup": "..."}'
  mode="author"
  configuration='{"@pie-element/multiple-choice": {}}'
  onmodel-updated={(e) => console.log('Model updated:', e.detail)}
></pie-iife-player>
```

### pie-esm-player

```html
<pie-esm-player
  config='{"elements": {...}, "models": [...], "markup": "..."}'
  mode="author"
  configuration='{"@pie-element/multiple-choice": {}}'
  onmodel-updated={(e) => console.log('Model updated:', e.detail)}
></pie-esm-player>
```

### PieItemPlayer (Svelte)

```svelte
<script>
  import { PieItemPlayer } from '@pie-framework/pie-players-shared/components';

  function handleModelUpdated(detail) {
    console.log('Model updated:', detail);
    // Save to backend
  }
</script>

<PieItemPlayer
  itemConfig={config}
  mode="author"
  configuration={configurationObject}
  onModelUpdated={handleModelUpdated}
/>
```

### PiePreviewLayout (Svelte)

For a complete authoring experience with preview toggle:

```svelte
<script>
  import { PiePreviewLayout } from '@pie-framework/pie-players-shared/components';

  let mode = $state('author');

  function handleModelUpdated(detail) {
    // Handle model updates
  }
</script>

<PiePreviewLayout
  bind:mode
  itemConfig={config}
  configuration={configurationObject}
  onModelUpdated={handleModelUpdated}
/>
```

## Event Handling

### model.updated Event

Emitted when the user makes changes in authoring mode:

```typescript
interface ModelUpdatedEvent {
  detail: {
    update: any;      // The updated model data
    reset: boolean;   // Whether this is a full reset
  }
}
```

Example handler:

```javascript
function handleModelUpdated(event) {
  const { update, reset } = event.detail;

  if (reset) {
    // Full model reset - replace entire model
    config.models = [update];
  } else {
    // Partial update - merge with existing model
    config.models = config.models.map(m =>
      m.id === update.id ? { ...m, ...update } : m
    );
  }

  // Save to backend
  await saveConfig(config);
}
```

## Asset Management

### Image Upload

```typescript
function onInsertImage(handler: ImageHandler) {
  // Show file picker or handle paste
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Upload to server
      uploadImage(file).then(url => {
        handler.done(undefined, url);
      }).catch(err => {
        handler.done(err);
      });
    } else {
      handler.cancel();
    }
  };

  input.click();
}
```

### Default DataURL Handler

A default implementation is provided that converts files to base64 DataURLs:

```typescript
import {
  createDefaultImageInsertHandler,
  createDefaultImageDeleteHandler
} from '@pie-framework/pie-players-shared/pie/asset-handler';

const onInsertImage = createDefaultImageInsertHandler((src) => {
  console.log('Image inserted:', src);
});

const onDeleteImage = createDefaultImageDeleteHandler();
```

## Implementation Details

### Markup Transformation

When `mode='author'`, markup is automatically transformed:

```typescript
// Input markup
'<multiple-choice-element id="Q124"></multiple-choice-element>'

// Transformed (authoring mode)
'<multiple-choice-element-config id="Q124"></multiple-choice-element-config>'
```

### Bundle Loading

```typescript
// IIFE Loader
const bundleType = mode === 'author'
  ? BundleType.editor
  : (hosted ? BundleType.player : BundleType.clientPlayer);

await iifeLoader.load(config, document, bundleType, needsControllers);
```

### Configure Initialization

```typescript
import { initializeConfiguresFromLoadedBundle } from '@pie-framework/pie-players-shared/pie/configure-initialization';

const authoringEnv = {
  ...env,
  mode: 'author',
  configuration
};

initializeConfiguresFromLoadedBundle(itemConfig, configuration, {
  env: authoringEnv
});
```

## Example Usage

Use the `PiePreviewLayout` and `PieItemPlayer` examples in this guide as the canonical integration pattern.

## API Reference

### Player Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `'view' \| 'author'` | `'view'` | Player mode |
| `configuration` | `Record<string, any>` | `{}` | Authoring configuration |
| `onModelUpdated` | `(detail: any) => void` | - | Model update callback |
| `onInsertImage` | `(handler: ImageHandler) => void` | - | Image upload handler |
| `onDeleteImage` | `(src: string, done: Function) => void` | - | Image delete handler |
| `onInsertSound` | `(handler: SoundHandler) => void` | - | Sound upload handler |
| `onDeleteSound` | `(src: string, done: Function) => void` | - | Sound delete handler |

### Preview Components

#### PiePreviewToggle

Simple toggle between author and preview modes.

```svelte
<PiePreviewToggle
  mode={currentMode}
  onModeChange={(newMode) => currentMode = newMode}
/>
```

#### PiePreviewLayout

Complete authoring layout with toggle and dual players.

```svelte
<PiePreviewLayout
  bind:mode
  itemConfig={config}
  configuration={configuration}
  env={env}
  session={session}
  onModelUpdated={handleModelUpdated}
/>
```

## Migration from pie-player-components

If you're migrating from `@pie-framework/pie-player-components`:

### Before (pie-player-components)

```jsx
<PieAuthor
  config={config}
  configuration={configuration}
  onModelUpdated={handleUpdate}
/>
```

### After (pie-players)

```html
<pie-iife-player
  config={config}
  mode="author"
  configuration={configuration}
  onmodel-updated={handleUpdate}
></pie-iife-player>
```

Or with Svelte:

```svelte
<PieItemPlayer
  itemConfig={config}
  mode="author"
  configuration={configuration}
  onModelUpdated={handleUpdate}
/>
```

## Troubleshooting

### Configure elements not loading

- Verify `mode='author'` is set
- Check that editor bundles are available for the elements
- Check browser console for loading errors
- Verify element tags match between markup and elements object

### Model updates not working

- Ensure `onModelUpdated` handler is attached
- Check browser console for `model.updated` events
- Verify configure elements are properly initialized
- Check that the element supports authoring mode

### Asset upload not working

- Verify asset handler callbacks are provided
- Check browser console for asset events
- Test with default DataURL handlers first
- Ensure file picker permissions are granted

## Future Enhancements

Planned for future releases:

- Item bank browser integration
- Version history and undo/redo
- Collaborative editing support
- Real-time preview sync

## Resources

- Type Definitions: `/packages/players-shared/src/pie/types.ts`
- Configure Initialization: `/packages/players-shared/src/pie/configure-initialization.ts`
- Asset Management: `/packages/players-shared/src/pie/asset-handler.ts`
- Preview Components: `/packages/players-shared/src/components/PiePreview*.svelte`

## Support

For issues or questions:
- GitHub Issues: https://github.com/pie-framework/pie-players/issues
- Slack: #pie-players channel
