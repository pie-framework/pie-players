# Calculator Providers

Calculator providers for PIE assessment tools.

## Available Provider

### Desmos Provider (Requires License)

Best for graphing and production calculator experiences.

```typescript
import { desmosProvider } from "$lib/assessment-toolkit/tools";

await desmosProvider.initialize({
  apiKey: "your_desmos_api_key_here",
});

const calculator = await desmosProvider.createCalculator("graphing", container, {
  theme: "light",
  restrictedMode: false,
});
```

Notes:
- Production usage requires a Desmos API key.
- Development/testing can run without a key in fallback mode.

## Provider Comparison

| Feature | Desmos |
|---------|--------|
| Basic calculator | Yes |
| Scientific calculator | Yes |
| Graphing calculator | Yes |
| License | Proprietary |
| Status | Production |

## Provider Interface

All providers implement the same `CalculatorProvider` contract from `@pie-players/pie-calculator`, so consumers can swap providers without changing calling patterns.
