# PIE Fixed Player - Quick Start

Get testing in 2 minutes using the CLI-based workflow in this repo.

## TL;DR

```bash
# From this repo root
bun install

# Build a fixed-player-static package from an in-repo config
bun run cli pie-packages:fixed-player-build-package \
  --elements-file configs/fixed-player-static/example.json

# Generate a minimal browser test project that imports the built package
bun run cli pie-packages:fixed-player-build-and-test-package \
  --elements-file configs/fixed-player-static/example.json \
  --generate-test-project
```

## What You Get

✅ **pie-fixed-player** - Custom element with pre-loaded bundles  
✅ **data-only endpoint** - `/api/item/{id}/data-only`  
✅ **Build system** - Generate packages from element combinations  
✅ **CLI testing** - Automated test project generation  
✅ **Local testing** - No npm publishing needed  

## Step-by-Step

### 1. Build a Package

```bash
bun run cli pie-packages:fixed-player-build-package \
  --elements-file configs/fixed-player-static/example.json
```

**Output**: Package in `local-builds/` (and a versioned output directory when publishing).

### 2. Test Locally

```bash
# Generate a test project
bun run cli pie-packages:fixed-player-build-and-test-package \
  --elements-file configs/fixed-player-static/example.json \
  --generate-test-project
```

The CLI prints the output directory for the generated test project. From that directory:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

### 3. Configure Test App

In the web UI:
1. **API Base URL**: `http://localhost:3000`
2. **JWT Token**: (from your auth)
3. **Item ID**: (test item)
4. Click to load

### 4. Test & Compare

- Toggle between `pie-fixed-player` and `pie-inline-player`
- Check load times in debug panel
- Try different items
- Verify elements work

## Iteration (bugfix rebuilds for the same element combination)

```bash
# Publish without specifying --iteration and the CLI will auto-pick the next available iteration:
bun run cli pie-packages:fixed-player-build-package \
  --elements-file configs/fixed-player-static/example.json \
  --publish
```

## Troubleshooting

### "Build failed"

Check:
- PITS is accessible
- Element versions exist
- Config JSON is valid

### API errors

Check:
- Pieoneer is running (`http://localhost:3000`)
- Token is valid
- Item exists
- `/data-only` endpoint exists

## Documentation

- **This file** - Quick start
- `README.md` - Overview
- `DESIGN.md` - Architecture details
- `docs/fixed-player-static/README.md` - Configs + CI/CD publishing

## What's Different?

### pie-inline-player (original)
- Loads bundles at runtime
- Large API responses (~500KB-2MB)
- Works with any elements

### pie-fixed-player (new)
- Bundles pre-loaded at build time
- Small API responses (~50-200KB)
- Fixed elements, faster runtime

## Next Steps

1. ✅ **Test locally** (you're here!)
2. ⏳ **Compile Svelte to standalone JS**
3. ⏳ **Deploy data-only endpoint**
4. ⏳ **Set up npm publishing**
5. ⏳ **Production testing**

## Questions?

See:
- `DESIGN.md` for architecture
- `docs/fixed-player-static/README.md` for configs + CI/CD

---

**Ready to test?** Run: `bun run cli pie-packages:fixed-player-build-and-test-package --elements-file configs/fixed-player-static/example.json --generate-test-project`

