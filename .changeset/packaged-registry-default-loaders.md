---
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-assessment-toolkit": patch
---

`createPackagedToolRegistry()` installs `DEFAULT_TOOL_MODULE_LOADERS` by default, so a bare call loads each tool's element on first render instead of rendering buttons that load nothing. A `toolModuleLoaders` map replaces the default; a host that defines its tool elements itself passes `toolModuleLoaders: {}`.
