# Migration Checklist: @pie-framework/pie-print → @pie-player/print

This document outlines the steps to migrate production applications from the legacy `@pie-framework/pie-print` to the new `@pie-player/print`.

## Quick Summary

✅ **API is identical** - No code changes needed in most cases
✅ **Drop-in replacement** - Just update the CDN URL
✅ **Backwards compatible** - Works with existing element packages
✅ **Modern dependencies** - Lit 3.x, latest TypeScript

## Migration Steps

### 1. Update Script Tag

**Before:**
```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@pie-framework/pie-print@2.7.0/lib/pie-print.js"></script>
```

**After:**
```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@pie-player/print@1.0.0/dist/print-player.js"></script>
```

### 2. Update Element Resolution (If Customized)

If you're using a custom resolver for newer pie-elements-ng packages:

**Before:**
```javascript
player.resolve = (tagName, pkg) => {
  const [_, name, version] = pkg.match(/@pie-element\/(.*?)@(.*)/);
  return Promise.resolve({
    tagName,
    pkg,
    url: `https://cdn.jsdelivr.net/npm/${pkg}/module/print.js`,
    module: true
  });
};
```

**After:**
```javascript
player.resolve = (tagName, pkg) => {
  const [_, name, version] = pkg.match(/@pie-element\/(.*?)@(.*)/);
  return Promise.resolve({
    tagName,
    pkg,
    // Updated path for pie-elements-ng packages
    url: `https://cdn.jsdelivr.net/npm/@pie-element/${name}@${version}/dist/print/index.js`,
    module: true
  });
};
```

### 3. Test

No other changes needed! Test the following scenarios:

- [ ] Student worksheet renders correctly
- [ ] Instructor answer key shows answers and rationales
- [ ] Multi-element items work (passage + questions)
- [ ] Math rendering works
- [ ] Print to PDF works
- [ ] Role switching works

## What Stays the Same

✅ The `<pie-print>` custom element tag
✅ The `config` property structure
✅ Role-based rendering (`student` vs `instructor`)
✅ All element types and versions
✅ Multi-element support
✅ Floater handling
✅ Error placeholders

## What's Different

### Package Name
- Old: `@pie-framework/pie-print`
- New: `@pie-player/print`

### File Path
- Old: `lib/pie-print.js`
- New: `dist/print-player.js`

### Dependencies
- Old: Lit 2.0 RC
- New: Lit 3.3.2 (stable)

### Default Element Resolution
- Old: `/module/print.js` (legacy pie-elements)
- New: `/dist/print/index.js` (pie-elements-ng)
- **Note**: Both work! Old elements still resolve correctly.

## Example Migration: pieoneer

**File:** `src/routes/(protected)/item/[[id]]/print/+page.svelte`

```diff
  onMount(() => {
-   const playerUrl = `https://cdn.jsdelivr.net/npm/@pie-framework/pie-print@${data.player}/lib/pie-print.js`;
+   const playerUrl = `https://cdn.jsdelivr.net/npm/@pie-player/print@${data.player}/dist/print-player.js`;

    loadScript(playerUrl)
      .then(() => {
        loaded = true;
      })
  });
```

That's it! No other changes needed.

## Rollback Plan

If issues arise, rollback is simple:

1. Change URL back to `@pie-framework/pie-print@2.7.0`
2. No code changes needed

## Testing Checklist

Before deploying to production:

- [ ] Test with legacy pie-elements packages (e.g., `@pie-element/multiple-choice@11.4.3`)
- [ ] Test with new pie-elements-ng packages (if using)
- [ ] Test student role rendering
- [ ] Test instructor role rendering
- [ ] Test multi-element items (passage + questions)
- [ ] Test floater elements (rubrics)
- [ ] Test math rendering (LaTeX)
- [ ] Test print to PDF
- [ ] Test in all target browsers
- [ ] Load test with many items

## Version Strategy

### Conservative Approach
Pin to specific version for stability:
```javascript
const playerUrl = `https://cdn.jsdelivr.net/npm/@pie-player/print@1.0.0/dist/print-player.js`;
```

### Latest Approach
Always get latest patches:
```javascript
const playerUrl = `https://cdn.jsdelivr.net/npm/@pie-player/print@latest/dist/print-player.js`;
```

### Version Selector (Recommended)
Let users choose version (pieoneer pattern):
```javascript
const playerUrl = `https://cdn.jsdelivr.net/npm/@pie-player/print@${userSelectedVersion}/dist/print-player.js`;
```

## Benefits of Migration

✅ **Modern dependencies** - Lit 3.x with latest features and fixes
✅ **Better TypeScript support** - Full type definitions
✅ **Improved error handling** - Better error messages
✅ **Active maintenance** - Part of pie-players monorepo
✅ **Consistent naming** - Matches `@pie-player/*` ecosystem
✅ **Updated documentation** - Complete examples and guides

## Support

- **Documentation**: See [README.md](./README.md) and [USAGE_EXAMPLE.md](./USAGE_EXAMPLE.md)
- **Issues**: Report at [pie-players/issues](https://github.com/pie-framework/pie-players/issues)
- **Legacy support**: `@pie-framework/pie-print@2.7.0` remains available

## Timeline Recommendation

1. **Week 1-2**: Test in staging environment
2. **Week 3**: Gradual production rollout (10% → 50% → 100%)
3. **Week 4**: Monitor and stabilize
4. **Month 2**: Fully migrate, deprecate old version

## FAQ

**Q: Will my existing element packages work?**
A: Yes! Both legacy (`module/print.js`) and new (`dist/print/index.js`) paths work.

**Q: Do I need to update element packages?**
A: No, existing elements work as-is.

**Q: Can I use both versions simultaneously?**
A: Not recommended on the same page, but you can A/B test different pages.

**Q: What about custom print components?**
A: If you built custom print elements, they'll work without changes as long as they follow the standard API (`model` setter, `options` setter).

**Q: Performance impact?**
A: Negligible - same loading pattern, same bundle size (~31KB).

---

**Migration Date**: February 2026
**Status**: Ready for production
**Risk Level**: Low (drop-in replacement)
