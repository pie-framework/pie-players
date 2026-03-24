# PIE Assessment Player Demos

Demonstrations for the PIE assessment player and toolkit host integration.

## Running the Demos

```bash
# From monorepo root
bun install

# First run on a fresh checkout (build package dist outputs + start demos)
bun run dev:assessment -- --rebuild

# Normal daily start
bun run dev:assessment
# Opens http://localhost:5500

# Optional: watch section/assessment shared package builds while iterating on libraries
bun run build:watch:section-tools
```

Use root scripts rather than running `bun run dev` directly inside
`apps/assessment-demos`; root scripts apply shared monorepo startup behavior.
