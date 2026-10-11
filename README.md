# PIE Players

Players, an assessment toolkit and accessibility tools for [PIE](https://pie-framework.org) (Portable Interactions and Elements) assessment content. Every player is a custom element, so it runs in any web page, with any framework or none.

- **Item player** renders one PIE item, for delivery or authoring.
- **Section player** composes the items and passages of one section, with layouts, toolbars and section session state.
- **Assessment toolkit** coordinates tools, accommodations, text-to-speech, highlighting and accessibility catalogs, and resolves which tools each learner receives.
- **Tools**: calculators, ruler, protractor, line reader, answer eliminator, highlighter, dictionaries, color schemes, sign language video and more.
- **Print player** renders items for paper and answer keys; **theme** carries design tokens and color schemes.

The PIE elements these players render, the question types and passages, come from [pie-elements-ng](https://github.com/pie-framework/pie-elements-ng). Hosts assemble their production assessment players from these building blocks; `@pie-players/pie-assessment-player` is a reference assembly ([product scope](docs/architecture/architecture.md#product-scope)).

![PIE Players building blocks: the host embeds the item, section, print or reference assessment player; the assessment toolkit configures them and places tools; every player renders PIE elements](docs/img/building-blocks.excalidraw.svg)

## Quick start

```bash
npm install @pie-players/pie-item-player
```

Or, without a build step:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@pie-players/pie-item-player@x.y.z/dist/pie-item-player.js"
></script>
<pie-item-player id="player"></pie-item-player>
```

[Getting started](docs/getting-started.md) renders an item, saves the learner's response and scores it.

## Documentation

| Guide | Covers |
| --- | --- |
| [Getting started](docs/getting-started.md) | A first item in a page |
| [Installing](docs/install/packages.md) | Packages, entry points, versions and pinning |
| [Architecture](docs/architecture/architecture.md) | How the players, toolkit, tools and elements fit together |
| [Item player](docs/item-player/overview.md) | Loading strategies, modes, sessions, scoring |
| [Section player](docs/section-player/integration-guide.md) | Sections, layouts, navigation, persistence |
| [Assessment toolkit](packages/assessment-toolkit/README.md) | Tools, accommodations and tool policy |
| [Accessibility](docs/accessibility/README.md) | Text-to-speech, accessibility catalogs, WCAG |
| [Theming](docs/theming/how-theming-works.md) | Design tokens and color schemes |
| [Security](docs/security/readme.md) | Answer keys, hosted mode, trust boundaries |
| [All documentation](docs/readme.md) | The full index |

## Packages

The `@pie-players/*` packages release together under one version number, written `x.y.z` in these docs; the preloaded player is versioned on its own. [Packages and entry points](docs/install/packages.md) lists every package and what it needs, and [versioning](docs/install/versioning.md) covers pinning and stability.

## Contributing

The packages are built with Bun, TypeScript and Svelte 5. Each custom-element package bundles its UI runtime (Svelte 5; Lit for the print player), so hosts install no framework.

```bash
bun install
bun run dev:section -- --rebuild   # first run: builds package dist outputs
bun run dev:section                # section demos
bun run test
```

Contributors need Bun 1.3.11 and Node 22.16 (`.nvmrc`); the [demo system](docs/setup/demo_system.md#prerequisites) lists the rest of the toolchain. [Environment setup](docs/setup/environment-setup.md) covers the demos' environment variables and [releasing](docs/setup/publishing.md) the release workflow.

## License

MIT.
