# Math.js Calculator Demo

Interactive demo showcasing both Vanilla TypeScript and Svelte implementations of the Math.js calculator.

## Quick Start

From the `calculator-mathjs` package root:

```bash
bun run demo
```

This will:
1. Install demo dependencies
2. Start Vite dev server
3. Open browser at http://localhost:3000

Or directly from the demo directory:

```bash
cd demo
bun install
bun run dev
```

## Features

The demo allows you to:

- **Switch between implementations**: Compare Vanilla TypeScript vs Svelte
- **Try different calculator types**: Basic vs Scientific
- **Test themes**: Light, Dark, Auto (system preference)
- **Interact with the calculator**: All features work live
- **See accessibility features**: WCAG 2.2 Level AA compliance demonstrated

## What's Demonstrated

### Accessibility Features
- ✅ Keyboard navigation (arrow keys + shortcuts)
- ✅ Screen reader support (ARIA labels, live regions)
- ✅ Focus indicators (3px solid outline)
- ✅ Touch-friendly buttons (48x48px)
- ✅ High contrast mode support

### Calculator Features
- ✅ Basic arithmetic operations
- ✅ Scientific functions (trig, log, power)
- ✅ Memory operations (MC, MR, M+, M-)
- ✅ Calculation history
- ✅ Error handling
- ✅ State persistence

### Implementation Comparison
The demo includes a side-by-side comparison table showing:
- Bundle size differences (40% smaller with Svelte)
- Code organization (7 components vs 1 file)
- Maintainability benefits
- Performance characteristics

## Testing Accessibility

### Keyboard Navigation
1. Tab to the calculator
2. Use arrow keys to navigate buttons
3. Press Enter or Space to activate buttons
4. Try number keys for direct input
5. Press Escape to clear

### Screen Reader Testing
1. Enable your screen reader (NVDA, JAWS, VoiceOver)
2. Navigate to the calculator
3. Hear button labels and calculation results
4. Notice live region announcements

### High Contrast Mode
- Windows: Alt + Shift + Print Screen
- macOS: System Preferences > Accessibility > Display

## Building for Production

```bash
npm run demo:build
```

Creates optimized production build in `demo/dist/`.

## Development

The demo uses:
- **Vite**: Fast dev server with HMR
- **Svelte 5**: Latest Svelte with runes
- **DaisyUI**: Tailwind CSS component library
- **Math.js**: Mathematical computation

### File Structure

```
demo/
├── index.html           # Entry HTML
├── App.svelte          # Main demo app
├── main.ts             # App bootstrap
├── style.css           # Global styles
├── vite.config.ts      # Vite configuration
├── package.json        # Demo dependencies
└── README.md           # This file
```

## Customization

### Add More Themes

Edit `App.svelte`:

```svelte
<select bind:value={selectedTheme}>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
  <option value="corporate">Corporate</option>
  <option value="cyberpunk">Cyberpunk</option>
</select>
```

### Add More Features

The demo app is fully modifiable. You can:
- Add custom styling examples
- Show state export/import
- Demonstrate programmatic API usage
- Add performance benchmarks

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ iOS Safari 14+
- ✅ Android Chrome 90+

## Troubleshooting

### Port Already in Use

If port 3000 is busy, Vite will automatically try 3001, 3002, etc.

Or specify a different port in `vite.config.ts`:

```typescript
server: {
  port: 5173
}
```

### Math.js Not Loading

Make sure dependencies are installed:

```bash
cd demo
npm install
```

### Svelte Component Not Found

The demo expects the calculator package to be built. From the package root:

```bash
npm run build
```

## License

MIT - Part of PIE Assessment Toolkit
