# @pie-element/print-player

A web component that dynamically loads and renders PIE (Platform Independent Elements) in print-friendly mode.

## Overview

The print player is a specialized, non-interactive version of the PIE element player. It:

- Dynamically loads print modules from CDN or custom URLs
- Registers print-specific custom elements
- Transforms interactive element markup into print-friendly versions
- Handles both embedded elements (in markup) and floater elements (like rubrics)
- Provides graceful fallbacks for missing or failed elements

## Installation

```bash
npm install @pie-element/print-player
# or
bun add @pie-element/print-player
```

## Usage

### Basic Example

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@pie-element/print-player@1.0.0/dist/print-player.js"></script>
  </head>
  <body>
    <pie-print id="player"></pie-print>

    <script>
      const player = document.querySelector('#player');

      player.config = {
        item: {
          markup: '<multiple-choice id="q1"></multiple-choice>',
          elements: {
            'multiple-choice': '@pie-element/multiple-choice@12.0.0'
          },
          models: [{
            id: 'q1',
            element: 'multiple-choice',
            prompt: 'What is 2 + 2?',
            choices: [
              { label: '3', value: 'a', correct: false },
              { label: '4', value: 'b', correct: true },
              { label: '5', value: 'c', correct: false }
            ]
          }]
        },
        options: {
          role: 'student' // or 'instructor' to show answers
        }
      };
    </script>
  </body>
</html>
```

### Custom Resolver

Override the default CDN resolution to use custom URLs:

```javascript
const player = document.querySelector('pie-print');

// Custom resolver for local development
player.resolve = (tagName, pkg) => {
  const [_, name, version] = pkg.match(/@pie-element\/(.*?)@(.*)/);
  return Promise.resolve({
    tagName,
    pkg,
    url: `http://localhost:3000/${name}/dist/print/index.js`,
    module: true
  });
};

player.config = { /* ... */ };
```

### Multiple Items

You can use multiple `<pie-print>` elements on the same page:

```html
<pie-print id="item-1"></pie-print>
<pie-print id="item-2"></pie-print>

<script>
  document.querySelector('#item-1').config = { /* item 1 config */ };
  document.querySelector('#item-2').config = { /* item 2 config */ };
</script>
```

## Configuration

### Config Object

```typescript
interface Config {
  item: {
    markup: string;           // HTML with element placeholders
    elements: {               // Map of tag names to package@version
      [tagName: string]: string;
    };
    models: Array<{           // Element configurations
      id: string;             // Unique ID matching markup
      element: string;        // Element tag name
      [key: string]: any;     // Element-specific properties
    }>;
  };
  options?: {
    role?: 'student' | 'instructor';  // Affects answer visibility
  };
}
```

### Role-Based Rendering

- **Student role**: Shows questions only, no answers or rationales
- **Instructor role**: Shows questions with correct answers and rationales

```javascript
// Student worksheet
player.config = {
  item: { /* ... */ },
  options: { role: 'student' }
};

// Answer key
player.config = {
  item: { /* ... */ },
  options: { role: 'instructor' }
};
```

## Architecture

### How It Works

1. **Resolution**: Converts element package names to CDN URLs
2. **Loading**: Dynamically imports print modules as ES modules
3. **Registration**: Registers custom elements with hash-suffixed names
4. **Transformation**: Replaces interactive tags with print-specific tags
5. **Data Binding**: Applies model data to rendered elements

### Hash-Based Naming

Print elements are registered with unique names to avoid conflicts:

```
multiple-choice → multiple-choice-print-123456789
```

This allows multiple versions of the same element to coexist.

## API

### Properties

- `config: Config` - Item configuration (reactive)
- `resolve: ResolverFn` - Custom URL resolver function
- `missingElement: MissingElFn` - Custom error placeholder factory

### Events

None - the print player is purely presentational.

## Browser Compatibility

- Modern browsers with ES2020+ support
- Custom Elements v1
- ES Modules
- Dynamic import()

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Watch mode
bun run dev

# Serve demo
bun run serve
```

## Migration from @pie-framework/pie-print

This package is a drop-in replacement for `@pie-framework/pie-print` with:

- Updated to Lit 3.x (from Lit 2.0 RC)
- TypeScript support
- Modern ESM packaging
- Support for pie-elements-ng packages
- Updated default CDN URLs

**Change the script URL:**

```diff
- <script type="module" src="https://cdn.jsdelivr.net/npm/@pie-framework/pie-print@2.7.0/lib/pie-print.js"></script>
+ <script type="module" src="https://cdn.jsdelivr.net/npm/@pie-element/print-player@1.0.0/dist/print-player.js"></script>
```

The API remains the same - no code changes needed!

## License

MIT
