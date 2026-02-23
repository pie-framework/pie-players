# pie-inline-player Web Component

A standalone web component that renders a PIE item from a single, packaged request (item data plus required JavaScript bundles). This is not the primary/recommended integration path, but it can be a pragmatic fallback to reduce round trips—for example on high‑latency or unstable networks, behind strict proxies, or in kiosk-like environments. Trade‑offs include a larger payload, coarser caching, and higher retry cost if the transfer fails.

## Usage

You can use the component in two ways: via npm install, or directly from a CDN.

### 1) Install from NPM

```bash
npm install @pie-framework/pie-inline-player
```

Then import it once to register the custom element and use the tag:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PIE Inline Player</title>
  <script type="module">
    import '@pie-framework/pie-inline-player';
  </script>
  </head>
  <body>
    <pie-inline-player
      item-id="your-item-id-here"
      api-base-url="https://your-pieoneer-instance.com"
      token="your-client-jwt-here"
    ></pie-inline-player>
  </body>
  </html>
```

### 2) Load directly from NPM (CDN)

You can include the module directly from a CDN such as jsDelivr:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PIE Inline Player</title>
  <script type="module" src="https://cdn.jsdelivr.net/npm/@pie-framework/pie-inline-player@latest/pie-inline-player.mjs"></script>
</head>
<body>
  <pie-inline-player
    item-id="your-item-id-here"
    api-base-url="https://your-pieoneer-instance.com"
    token="your-client-jwt-here"
  ></pie-inline-player>
</body>
</html>
```

### Component Attributes

- `item-id` (required): The ID of the PIE item to load.
- `api-base-url` (required): The base URL of the Pieoneer instance hosting the packaged item API endpoint.
- `token` (required): A valid JWT for authenticating with the API endpoint.
- `loader-mode` (optional, default: `'inline'`): **Testing feature** - Set to `'fixed'` to simulate `pie-fixed-player` behavior
- `bundle-url` (optional): URL to pre-load bundle from (used in `'fixed'` mode)
- `env` (optional): Environment config `{ mode: 'gather'|'view'|'evaluate', role: 'student'|'instructor' }`
- `session` (optional): Session data array
- `add-correct-response` (optional): Force showing correct answers
- `external-style-urls` (optional): External CSS URLs
- `custom-class-name` (optional): Custom CSS class for the player
- `container-class` (optional): Custom CSS class for the item container
- `passage-container-class` (optional): Custom CSS class for the passage container

## Testing Fixed-Player Behavior

The `pie-inline-player` includes a **test mode** to simulate `pie-fixed-player` behavior without needing to build and deploy a static package. This is useful for testing the shared bundle loading logic.

### Fixed Mode Usage

```html
<pie-inline-player
  item-id="your-item-id"
  api-base-url="https://your-pieoneer-instance.com"
  token="your-jwt"
  loader-mode="fixed"
  bundle-url="https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@8.2.4/dist/bundle.js"
></pie-inline-player>
```

### How It Works

**Inline Mode** (default):

1. Fetches item data + bundles via `/api/item/{id}/packaged`
2. Injects bundles dynamically as blob URLs
3. Initializes player with shared logic

**Fixed Mode** (for testing):

1. Pre-loads bundle from `bundle-url` (simulates package import)
2. Fetches item data only via `/api/item/{id}/data-only`
3. Initializes player with **identical shared logic** as `pie-fixed-player`

### Why This Matters

Both `pie-inline-player` and `pie-fixed-player` use:

- Same API response formats
- Same player initialization logic
- Same configuration passing
- Same event handling

Testing in "fixed mode" gives confidence that `pie-fixed-player` will work without deploying to a test project!
