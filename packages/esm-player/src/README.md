# `<pie-esm-player>` - ESM PIE Player Web Component

A modern, ESM-only web component for rendering PIE (Portable Interactive Elements) assessment items. This is a **functional replacement** for `<pie-player>` from `@pie-framework/pie-player-components`, using pure ESM loading instead of IIFE bundles.

## Features

- ✅ **Pure ESM Loading** - No IIFE fallback, modern browsers only
- ✅ **Same Interface as `<pie-player>`** - Drop-in replacement with identical props
- ✅ **Controller Integration** - Full model transformation via PIE controllers
- ✅ **Scoring Support** - `provideScore()` method for evaluation
- ✅ **Shadow DOM** - Isolated styles, no CSS conflicts
- ✅ **Configurable CDN** - Use esm.sh, jsDelivr, or custom CDN
- ✅ **Svelte 5** - Built with modern Svelte runes

## Installation

```bash
npm install @pie-framework/pie-esm-player
```

## Usage

### Basic Usage (Same as `<pie-player>`)

```html
<script type="module">
  import '@pie-framework/pie-esm-player';
</script>

<pie-esm-player
  config={itemConfig}
  env={{ mode: 'gather', role: 'student' }}
></pie-item-player>
```

### With Session

```html
<pie-esm-player
  config={itemConfig}
  env={{ mode: 'evaluate', role: 'instructor', partialScoring: true }}
  session={{ id: 'session-123', data: [] }}
  add-correct-response={true}
></pie-item-player>
```

### With Scoring

```javascript
const player = document.querySelector('pie-item-player');

// Score the item
const scores = await player.provideScore();
console.log('Scores:', scores);
```

## Props/Attributes

Matches `<pie-player>` interface exactly (minus IIFE-specific props):

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `config` | object | - | **Required** - PIE item configuration (ItemConfig or AdvancedItemConfig) |
| `env` | object | `{mode: 'gather', role: 'student'}` | Player environment |
| `session` | object | `{id: '', data: []}` | Session data for responses |
| `add-correct-response` | boolean | `false` | Show correct answers (for testing) |
| `show-bottom-border` | boolean | `false` | Add border between items (multi-item) |
| `hosted` | boolean | `false` | If true, controllers run on server (no local transformation) |
| `render-stimulus` | boolean | `true` | Render stimulus/passage layout |
| `allowed-resize` | boolean | `false` | Enable passage resize |
| `esm-cdn-url` | string | `https://esm.sh` | ESM CDN base URL |
| `esm-probe-timeout` | number | `1000` | Package probe timeout (ms) |
| `esm-probe-cache-ttl` | number | `3600000` | Probe cache TTL (ms, default 1 hour) |

## Methods

### `provideScore()`

Returns scoring results for all items in the player.

```javascript
const player = document.querySelector('pie-item-player');
const scores = await player.provideScore();

// Returns: Array<{ id: string, score: number, empty: boolean, max?: number }>
```

## Events

### `session-changed`
Fired when user interacts with a PIE element (matches `<pie-player>`).

```javascript
player.addEventListener('session-changed', (e) => {
  console.log('Session updated:', e.detail);
});
```

### `player-error`
Fired when an error occurs during loading or rendering.

```javascript
player.addEventListener('player-error', (e) => {
  console.error('Player error:', e.detail);
});
```

### `load-complete`
Fired when the item has finished loading and is ready.

```javascript
player.addEventListener('load-complete', () => {
  console.log('Item loaded successfully');
});
```

## Comparison with `<pie-player>` (Stencil)

| Feature | `<pie-esm-player>` (Svelte ESM) | `<pie-player>` (Stencil) |
|---------|----------------------------------|--------------------------|
| **Format** | ESM only | IIFE + ESM (dual mode) |
| **Interface** | Identical props/methods | ✅ |
| **Bundle Loading** | ESM import maps | IIFE scripts or ESM |
| **Browser Support** | Modern (Chrome 89+, Firefox 108+, Safari 16.4+) | All browsers |
| **Size** | ~8KB | ~50KB |
| **Complexity** | Low (single implementation) | High (dual format support) |
| **Use Case** | Modern apps, ESM-only environments | Legacy support, universal compatibility |
| **Scoring** | ✅ `provideScore()` | ✅ `provideScore()` |
| **Session Management** | Via props (external) | Via props (external) |

## Architecture

### ESM Loading Flow

1. **Receive Config** - Component receives PIE config via `config` prop
2. **Generate Import Map** - Creates import map for all PIE packages in config
3. **Inject Import Map** - Adds `<script type="importmap">` to document (once)
4. **Dynamic Import** - Uses `import()` to load each ESM package
5. **Register Elements** - Calls `customElements.define()` for each tag
6. **Store Controllers** - Saves controllers in internal registry
7. **Render Markup** - Injects item markup into DOM
8. **Initialize Elements** - Queries DOM, calls `controller.model()`, sets model/session
9. **Ready** - Fires `load-complete` event

### Controller Integration

Controllers transform raw models before rendering:
- **Shuffle choices** (in gather mode)
- **Show correct answers** (in evaluate mode with `add-correct-response`)
- **Apply scoring** (in evaluate mode via `provideScore()`)
- **Validate responses**

## Migration from `<pie-player>`

### Before (Stencil `<pie-player>`)

```html
<script type="module">
  // Load from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@pie-framework/pie-player-components@latest/dist/pie-player-components/pie-player-components.esm.js';
  document.head.appendChild(script);
</script>

<pie-player
  config={config}
  env={env}
  bundle-format="auto"
></pie-player>
```

### After (Svelte `<pie-esm-player>`)

```html
<script type="module">
  import '@pie-framework/pie-esm-player';
</script>

<pie-esm-player
  config={config}
  env={env}
></pie-item-player>
```

**Benefits:**
- ✅ Same interface, drop-in replacement
- ✅ 85% smaller bundle size
- ✅ No CDN dependency (bundled with your app)
- ✅ Faster loading (no external script fetch)
- ✅ Simpler (ESM only, no format detection)

## Browser Support

Requires browsers with:
- ✅ ES Modules (ESM)
- ✅ Import Maps
- ✅ Custom Elements v1
- ✅ Shadow DOM v1

**Supported:**
- Chrome 89+
- Firefox 108+
- Safari 16.4+
- Edge 89+

**Not Supported:**
- Internet Explorer (any version)
- Chrome < 89
- Firefox < 108
- Safari < 16.4

For older browser support, use `<pie-player>` from `@pie-framework/pie-player-components` which includes IIFE fallback.

## Development

### Local Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Publish to npm
npm publish
```

### Testing in PIEOneer

```svelte
<script>
  // (PIEOneer-only example removed for pie-players)
  
  let config = {
    elements: {
      'pie-multiple-choice': '@pie-element/multiple-choice@11.0.1-esmbeta.0'
    },
    models: [
      { id: '1', element: 'pie-multiple-choice', /* ... */ }
    ],
    markup: '<pie-multiple-choice id="1"></pie-multiple-choice>'
  };
  
  let env = { mode: 'gather', role: 'student' };
</script>

<pie-esm-player {config} {env}></pie-item-player>
```

## License

MIT

## Related

- [`@pie-framework/pie-player-components`](https://www.npmjs.com/package/@pie-framework/pie-player-components) - Original Stencil-based player with IIFE+ESM support
- [PIE Documentation](https://pie-api.readme.io/)