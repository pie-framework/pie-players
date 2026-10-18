---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-assessment-player": patch
---

The interface-locale provider seam: `runtime.i18n` on the section-player
layouts and an `i18n` property on `pie-assessment-toolkit` and
`pie-item-player` accept the `I18nProvider` a host composes — the generated
locale tier's catalogs, `customMessages`, or a provider of the host's own — in
place of the one the player builds. The `locale` attribute still names the
locale, and a supplied provider is driven only by it. A section now forwards
its provider to the item players it mounts, so their own chrome follows the
section's locale. `loadBundledCatalog("en-US")` now returns the statically
resident English catalog instead of throwing, so a host composing loaders —
the generated tier's pattern, or a pseudo-localization — can ask for it by
name. No listed host is affected: every surface is optional, a host that
supplies nothing renders what it rendered before, and the one rendering change
(nested item-player chrome following the section's locale) needs a `locale` no
host passes. See the host-supplied interface locale provider PRD
(`docs/prds/interface-i18n-host-provider.md`).
