# PIE Players Theming

PIE players now use a single theming architecture aligned with PIE elements:

- canonical `--pie-*` CSS tokens
- wrapper-driven theme application
- optional DaisyUI flavor mapping
- host-owned wrapper placement (players/tools do not render wrappers internally)

## Wrappers

- `@pie-players/pie-theme` registers `pie-theme`
- `@pie-players/pie-theme-daisyui` registers `pie-theme-daisyui`

Example:

```html
<pie-theme-daisyui theme="light" scope="document">
  <pie-assessment-player></pie-assessment-player>
</pie-theme-daisyui>
```

Supported attributes:

- `theme`: `light | dark | auto`
- `scope`: `self | document`
- `variables`: JSON object with `--pie-*` token overrides

## Canonical Tokens

Use the full PIE token surface in player/tool styles, including semantic tokens and
component-specific tokens mirrored from PIE elements:

- `--pie-text`
- `--pie-text-secondary`
- `--pie-background`
- `--pie-secondary-background`
- `--pie-border`, `--pie-border-light`, `--pie-border-dark`
- `--pie-primary`, `--pie-primary-light`, `--pie-primary-dark`
- `--pie-correct`, `--pie-incorrect`, `--pie-missing`
- component-specific tokens such as `--choice-input-*`, `--feedback-*-bg-color`,
  `--before-*`, `--arrow-color`, `--tick-color`, `--line-stroke`, `--point-*`

## Assessment Toolkit Integration

Assessment runtime theming now uses the same single wrapper/token mechanism:

- configure `assessment.settings.themeConfig` (`theme`, `scope`, `colorScheme`, `variables`)
- render players inside `pie-theme` or `pie-theme-daisyui`
- use canonical `--pie-*` token overrides only

## Breaking Changes

Removed legacy theming paths:

- `data-color-scheme`
- `data-font-size`
- legacy toolkit theme-provider fields (`highContrast`, `fontSize`, `backgroundColor`, etc.)
- legacy toolkit-specific tokens (`--pie-bg-color`, `--pie-fg-color`, `--pie-accent-color`)

Use wrapper attributes and canonical `--pie-*` token overrides instead.
