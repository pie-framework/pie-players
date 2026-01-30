# @pie-players/pie-calculator-desmos

Desmos calculator provider for PIE Players - Premium graphing, scientific, and basic calculators.

## Features

- ✅ Beautiful, intuitive graphing calculators
- ✅ Interactive expression lists
- ✅ Scientific and basic calculator modes
- ✅ State persistence and export
- ⚠️ Requires Desmos API key from [desmos.com/api](https://www.desmos.com/api)
- ⚠️ Requires internet connection

## Installation

```bash
npm install @pie-players/pie-calculator-desmos
```

## How Desmos API Keys Work

According to Desmos documentation, the API key should be included when loading the Desmos calculator library:

```html
<script src="https://www.desmos.com/api/v1.11/calculator.js?apiKey=YOUR_KEY"></script>
```

However, **this approach exposes your API key in client-side HTML**, which is a security risk for production applications.

## Security Best Practices

### ⚠️ Important Security Considerations

While Desmos's documentation shows the API key embedded in the script URL (client-side), this is **NOT SECURE for production** because:

1. Anyone can view your HTML source and see the API key
2. The key can be copied and used by others
3. You cannot rotate keys without redeploying your entire application
4. You have no control over who uses your key

### Our Recommended Patterns

This package supports three configuration patterns:

#### 1. Development Mode (Direct API Key) - Testing Only

Use the demo key or your own key for local development:

```html
<!-- Load Desmos with demo key -->
<script src="https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>
```

```typescript
import { DesmosCalculatorProvider } from '@pie-players/pie-calculator-desmos';

const provider = new DesmosCalculatorProvider();
await provider.initialize(); // Uses the globally loaded Desmos
```

⚠️ Only use your real API key like this during development!

#### 2. Production Mode (Server-Side Proxy) - ✅ RECOMMENDED

For production, use a server-side proxy to keep your API key secure:

```typescript
const provider = new DesmosCalculatorProvider();
await provider.initialize({
  proxyEndpoint: '/api/desmos/script-url' // Server returns the script URL with key
});
```

Your server endpoint returns a signed or time-limited URL.

#### 3. Pre-loaded Library (Client-Side)

If you must use client-side loading in production (not recommended), at least load the library yourself and don't pass the key through our package:

```html
<script src="https://www.desmos.com/api/v1.11/calculator.js?apiKey=YOUR_KEY"></script>
```

```typescript
const provider = new DesmosCalculatorProvider();
await provider.initialize(); // No key needed, uses window.Desmos
```

**Note**: This still exposes your key in HTML, but at least it's not in your JavaScript bundle.

## Server-Side Proxy Implementation

### Understanding the Challenge

Desmos requires the API key in the script URL when loading the library. To keep your key secure while still working within Desmos's architecture, you need a server-side proxy.

### Option A: Proxy the Desmos Script (Most Secure)

Create a server endpoint that proxies the Desmos calculator script with your API key:

#### Express.js Example

```javascript
// server.js
app.get('/api/desmos/calculator.js', requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Fetch Desmos script with your API key server-side
  const desmosUrl = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${process.env.DESMOS_API_KEY}`;
  const response = await fetch(desmosUrl);
  const script = await response.text();

  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});
```

Then load from your proxy in the client:

```html
<script src="/api/desmos/calculator.js"></script>
```

### Option B: Return Signed/Time-Limited URL

Create temporary, authenticated URLs that expire:

#### Next.js API Route Example

```typescript
// pages/api/desmos/script-url.ts
import { getServerSession } from 'next-auth';
import { sign } from 'jsonwebtoken';

export default async function handler(req, res) {
  const session = await getServerSession(req, res);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Create a time-limited token
  const token = sign(
    { userId: session.user.id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Return URL with your API key (only valid for this session)
  res.json({
    scriptUrl: `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${process.env.DESMOS_API_KEY}`,
    expiresAt: Date.now() + 3600000
  });
}
```

### Advantages of Server-Side Proxy

1. **Security**: API key never exposed to client in retrievable form
2. **Authentication**: Control who can access Desmos
3. **Rate Limiting**: Implement usage limits server-side
4. **Usage Tracking**: Monitor calculator usage for billing
5. **Key Rotation**: Change keys without redeploying client code
6. **Compliance**: Meets security requirements for sensitive data

### Reality Check

**Important**: Even with a proxy, if the client loads the Desmos script, a determined user could still inspect network traffic and find the API key embedded in the script content. For true security:

1. Consider if Desmos calculators are necessary for your use case
2. Use alternative open-source calculator libraries (like Math.js) when possible
3. Contact Desmos at <partnerships@desmos.com> to discuss enterprise security options
4. Implement rate limiting and usage monitoring to detect key misuse

## Usage

### Basic Calculator

```typescript
const provider = new DesmosCalculatorProvider();
await provider.initialize({ proxyEndpoint: '/api/desmos/token' });

const calculator = await provider.createCalculator(
  'basic',
  document.getElementById('calculator-container')
);
```

### Scientific Calculator

```typescript
const calculator = await provider.createCalculator(
  'scientific',
  document.getElementById('calculator-container'),
  {
    desmos: {
      degreeMode: true,
      functionDefinition: true
    }
  }
);
```

### Graphing Calculator

```typescript
const calculator = await provider.createCalculator(
  'graphing',
  document.getElementById('calculator-container'),
  {
    desmos: {
      expressions: true,
      settingsMenu: true,
      zoomButtons: true,
      plotInequalities: true
    }
  }
);
```

### Restricted/Test Mode

For assessments, you can restrict calculator features:

```typescript
const calculator = await provider.createCalculator(
  'graphing',
  container,
  {
    restrictedMode: true, // Disables settings, zoom, expressions topbar
    desmos: {
      restrictedFunctions: true // Additional Desmos restrictions
    }
  }
);
```

## Configuration Options

See the `DesmosCalculatorConfig` interface in `@pie-players/pie-calculator` for all available options.

Common options:

- `expressions`: Show/hide expression list (graphing)
- `settingsMenu`: Show/hide settings menu
- `zoomButtons`: Show/hide zoom controls
- `degreeMode`: Use degrees instead of radians
- `border`: Show calculator border
- `links`: Enable links to Desmos.com

## State Management

Save and restore calculator state:

```typescript
// Export state
const state = calculator.exportState();
localStorage.setItem('calculator-state', JSON.stringify(state));

// Import state
const savedState = JSON.parse(localStorage.getItem('calculator-state'));
calculator.importState(savedState);
```

## Loading Desmos API

The Desmos API must be loaded before initializing the provider. You can load it from CDN:

```html
<script src="https://www.desmos.com/api/v1.10/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>
```

Or load it dynamically in your application.

## License

This package is MIT licensed. The Desmos API requires a separate API key from Desmos.

## Links

- [Desmos API Documentation](https://www.desmos.com/api)
- [Get Desmos API Key](https://www.desmos.com/api)
- [PIE Calculator Base Package](https://www.npmjs.com/package/@pie-players/pie-calculator)
