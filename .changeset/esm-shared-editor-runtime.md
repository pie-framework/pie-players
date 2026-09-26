---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-print-player": patch
---

Under esm URL resolution, an element that declares `pie.browserEditorRuntime`
loads its editor-runtime variant, and the page's editors share one Tiptap and
ProseMirror from `@pie-element/shared-editor-runtime`, mapped once per page. An
element that runtime cannot serve, or whose variant fails to load, loads
`./browser/*` and is reported as a shared-dependency conflict. A package that
does not publish the requested view, such as match-list's `./browser/author`,
now fails alone with that missing export, and the other elements in the load
still register.
