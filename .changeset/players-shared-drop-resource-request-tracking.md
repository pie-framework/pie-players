---
"@pie-players/pie-players-shared": patch
---

Remove `createResourceMonitor` and the global resource-request tracking
(`initializeResourceRequestTracking`, `getTrackedResourceRequests`,
`clearTrackedResourceRequests`) from `dist/pie/resource-monitor.js`, and
`dist/pie/component-context.js`, which only that tracking used. Nothing called
them and no `exports` entry reaches either file, so only a deep import past the
`exports` map is affected.
