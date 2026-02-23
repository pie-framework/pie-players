# GitHub Pages Setup

This repository publishes the docs site from `apps/docs`.

## Local Build

```bash
bun run build:pages
```

The docs output is generated in `apps/docs/build`.

## Deployment Notes

- Use the Pages workflow configured in `.github/workflows/pages.yml`.
- Ensure workflow path filters include `apps/docs/**`, `packages/**`, and workflow files.
- Set repository Pages source to **GitHub Actions**.

## Verification

After deployment:

1. Open `https://<org>.github.io/pie-players/`
2. Verify docs routes load without asset 404s
3. Verify generated images and static assets render correctly
