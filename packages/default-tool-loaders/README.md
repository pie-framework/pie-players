# PIE Default Tool Loaders

Default lazy module loader mappings for built-in PIE assessment tools.

This package intentionally owns concrete `pie-tool-*` dependencies so toolkit core can remain dependency-light and cycle-safe.

## Usage

```ts
import { createDefaultToolRegistry } from "@pie-players/pie-assessment-toolkit";
import {
	DEFAULT_TOOL_MODULE_LOADERS,
	registerSectionToolModuleLoaders,
} from "@pie-players/pie-default-tool-loaders";

// Full default loaders (item + section tools)
const registry = createDefaultToolRegistry({
	toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
});

// Section-only loaders (for section toolbar bootstrap points)
registerSectionToolModuleLoaders(registry);
```

