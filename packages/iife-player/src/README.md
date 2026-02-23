# `<pie-iife-player>` - IIFE PIE Player Web Component

A web component for rendering PIE (Portable Interactive Elements) assessment items using dynamically loaded IIFE bundles from the PIE build service. This is a **drop-in replacement** for `<pie-player>` from `@pie-framework/pie-player-components`, using the same loading mechanism but with a modern, shared architecture.

## Features

- ✅ **Dynamic IIFE Loading** - Loads element bundles from PIE build service or CDN
- ✅ **Same Interface as `<pie-player>`** - Drop-in replacement with identical props
- ✅ **Multiple Environments** - Supports prod, stage, and dev bundle hosts
- ✅ **CDN Support** - Can use pre-built bundles with hash from CDN
- ✅ **Shared Architecture** - Uses same initialization as pie-fixed-player and pie-inline-player
- ✅ **Hosted Mode** - Supports both client-side and server-side model processing
- ✅ **Svelte 5** - Built with modern Svelte runes

## Installation

```bash
npm install @pie-framework/pie-iife-player
```

## Usage

### Basic Usage (Same as `<pie-player>`)

```html
<script type="module">
  import '@pie-framework/pie-iife-player';
</script>

<pie-iife-player
  config={itemConfig}
  env={{ mode: 'gather', role: 'student' }}
></pie-iife-player>
```

### With Custom Bundle Host

```html
<pie-iife-player
  config={itemConfig}
  env={{ mode: 'evaluate', role: 'instructor', partialScoring: true }}
  session={{ id: 'session-123', data: [] }}
  bundle-host="prod"
  use-cdn={true}
></pie-iife-player>
```

### With Custom Endpoints

```html
<pie-iife-player
  config={itemConfig}
  env={{ mode: 'gather', role: 'student' }}
  bundle-endpoints={{
    buildServiceBase: 'https://custom.example.com/bundles/',
    bundleBase: 'https://cdn.example.com/bundles/'
  }}
></pie-iife-player>
```

### Hosted Mode (Server-Side Processing)

```html
<pie-iife-player
  config={itemConfig}
  env={{ mode: 'evaluate', role: 'instructor' }}
  session={{ id: 'session-123', data: [] }}
  hosted={true}
></pie-iife-player>
```

## Props/Attributes

Matches `<pie-player>` interface exactly:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `config` | object | - | **Required** - PIE item configuration (ItemConfig or AdvancedItemConfig) |
| `env` | object | `{mode: 'gather', role: 'student'}` | Player environment |
| `session` | object | `{id: '', data: []}` | Session data for responses |
| `add-correct-response` | boolean | `false` | Show correct answers (for testing) |
| `show-bottom-border` | boolean | `false` | Add border between items (multi-item) |
| `hosted` | boolean | `false` | If true, controllers run on server (no local transformation) |
| `bundle-host` | string | `'prod'` | PIE build service environment ('prod', 'stage', 'dev') |
| `bundle-endpoints` | object | - | Custom endpoints for build service and CDN |
| `use-cdn` | boolean | `false` | Use CDN with bundle hash if available |
| `external-style-urls` | string | - | Comma-separated URLs for external stylesheets |
| `custom-class-name` | string | - | Custom class name for scoped styles |
| `container-class` | string | - | CSS class for item container |

## Events

### `session-changed`
Fired when user interacts with a PIE element (matches `<pie-player>`).

```javascript
player.addEventListener('session-changed', (e) => {
  console.log('Session updated:', e.detail);
});
```

### `load-complete`
Fired when PIE elements are loaded and ready.

```javascript
player.addEventListener('load-complete', () => {
  console.log('Player loaded');
});
```

### `player-error`
Fired when an error occurs during loading or rendering.

```javascript
player.addEventListener('player-error', (e) => {
  console.error('Player error:', e.detail);
});
```

## How It Works

1. **Bundle Loading**: Dynamically loads IIFE bundles from PIE build service based on element versions in config
2. **Element Registration**: Registers custom elements and controllers into global PIE registry
3. **Shared Rendering**: Uses `PieItemPlayer` component (same as pie-fixed-player) for rendering
4. **Initialization**: Uses shared PIE initialization utilities for consistent behavior

## Differences from Original `<pie-player>`

- Built with Svelte 5 instead of Stencil
- Uses shared architecture with pie-fixed-player and pie-inline-player
- More consistent error handling and logging
- No stimulus/passage-specific layout (use multiple instances for that)
- Better TypeScript support

## Bundle Types

The player automatically selects the correct bundle type based on the `hosted` prop:

- **client-player.js** (default): Includes element UI + controllers for client-side model processing
- **player.js** (hosted=true): Only includes element UI, models are processed server-side

## Migration from `<pie-player>`

Simply replace the tag name:

```html
<!-- Before -->
<pie-player config={config} env={env}></pie-player>

<!-- After -->
<pie-iife-player config={config} env={env}></pie-iife-player>
```

All props and events work exactly the same.

## License

MIT
