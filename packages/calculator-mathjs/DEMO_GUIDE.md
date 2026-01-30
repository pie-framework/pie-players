# Calculator Demo Guide

## Quick Start

The demo is now running! Open your browser to:

**http://localhost:3000**

## What You'll See

### Interactive Demo Features

1. **Implementation Switcher**
   - Toggle between Svelte Components and Vanilla TypeScript
   - See real-time differences in both implementations

2. **Calculator Type**
   - Switch between Basic and Scientific calculators
   - All features work in both modes

3. **Theme Selector**
   - Try Light, Dark, and Auto (system) themes
   - DaisyUI theming applies instantly

4. **Live Calculator**
   - Fully functional calculator
   - All keyboard shortcuts work
   - Screen reader compatible

5. **Feature Showcase**
   - Keyboard navigation guide
   - Accessibility features list
   - Calculator features overview

6. **Implementation Comparison Table**
   - Bundle size comparison (40% smaller with Svelte)
   - Code organization differences
   - Feature parity confirmation

## Running the Demo

### From Package Root

```bash
cd /Users/eelco.hillenius/dev/prj/pie/pie-players/packages/calculator-mathjs
bun run demo
```

### From Demo Directory

```bash
cd demo
bun install
bun run dev
```

### Stop the Demo

Press `Ctrl+C` in the terminal running the demo.

## Testing Features

### Try the Calculator

1. **Mouse/Touch**: Click buttons to input numbers and operators
2. **Keyboard**: Type numbers and operators directly (0-9, +, -, *, /, .)
3. **Arrow Keys**: Navigate between buttons (when grid is focused)
4. **Enter/=**: Calculate result
5. **Escape/C**: Clear calculator
6. **Backspace**: Delete last digit

### Test Accessibility

1. **Keyboard Navigation**
   - Tab to the calculator
   - Use arrow keys to move between buttons
   - Press Enter or Space to activate

2. **Screen Reader** (if available)
   - Enable NVDA (Windows) or VoiceOver (Mac)
   - Navigate to calculator
   - Hear button labels and results

3. **Focus Indicators**
   - Tab through the interface
   - Notice visible 3px outline on focused elements

4. **Theme Switching**
   - Try Light, Dark, and Auto themes
   - Verify contrast in all themes

### Compare Implementations

1. **Switch to Vanilla TypeScript**
   - Notice it still works exactly the same
   - Check browser DevTools for bundle size

2. **Switch to Svelte Components**
   - Same functionality
   - Smaller bundle size
   - Component architecture visible in DevTools

## What's Demonstrated

### ✅ WCAG 2.2 Level AA Compliance

- **2.1.1 Keyboard**: All functions accessible via keyboard
- **2.4.7 Focus Visible**: Clear 3px focus indicators
- **1.4.3 Color Contrast**: 4.5:1+ text, 3:1+ UI elements
- **1.1.1 Text Alternatives**: ARIA labels on all buttons
- **3.3.1 Error Identification**: Clear error messages
- **4.1.3 Status Messages**: Live region announcements

### ✅ Professional UI

- DaisyUI themed components
- Touch-friendly 48x48px buttons
- Responsive design (mobile to desktop)
- Smooth animations (respects prefers-reduced-motion)
- High contrast mode support

### ✅ Full Feature Set

- Basic arithmetic (+ - × ÷)
- Scientific functions (sin, cos, tan, √, log, ln, x^y)
- Memory operations (MC, MR, M+, M-)
- Calculation history
- Error handling with feedback
- State persistence ready

## Development

### Hot Module Replacement

The demo uses Vite with HMR. Changes to calculator components will update instantly in the browser without full reload.

### Modify the Demo

Edit `demo/App.svelte` to:
- Add more configuration options
- Show additional examples
- Demonstrate more features
- Add custom styling examples

### Build Production Version

```bash
bun run demo:build
```

Creates optimized build in `demo/dist/` folder.

## Troubleshooting

### Port Already in Use

If port 3000 is busy, Vite will automatically try 3001, 3002, etc. Check the terminal output for the actual URL.

### Browser Not Opening

Manually open: http://localhost:3000

### Components Not Loading

Make sure you're in the correct directory:

```bash
cd /Users/eelco.hillenius/dev/prj/pie/pie-players/packages/calculator-mathjs
bun run demo
```

### TypeScript Errors

The demo may show some TypeScript warnings but will still run. These are non-blocking development warnings.

### Svelte Warnings

The demo may show some Svelte accessibility warnings in development. These are helpful reminders but don't affect functionality.

## Next Steps

### Test Different Scenarios

1. **Mobile Testing**: Open on your phone (use network URL with `--host`)
2. **Tablet Testing**: Test touch interactions on tablet
3. **Screen Reader**: Full NVDA/JAWS/VoiceOver testing
4. **Keyboard Only**: Navigate entire demo without mouse
5. **High Contrast**: Enable system high contrast mode

### Compare Implementations

Use browser DevTools to compare:
- Bundle sizes (Network tab)
- Component structure (Elements/Inspector)
- Performance (Performance tab)
- Memory usage (Memory profiler)

### Customize

Fork the demo app to:
- Add your own examples
- Test integration patterns
- Demonstrate custom theming
- Show state persistence
- Add usage documentation

## Demo Files

```
demo/
├── index.html          # Entry HTML with DaisyUI CDN
├── App.svelte         # Main demo application
├── main.ts            # Bootstrap code
├── style.css          # Global styles
├── vite.config.ts     # Vite configuration
├── package.json       # Demo dependencies
└── README.md          # Demo documentation
```

## Browser DevTools Tips

### Check Accessibility

1. Open DevTools (F12)
2. Go to Accessibility tab (or Elements > Accessibility)
3. Inspect calculator elements
4. Verify ARIA attributes

### Monitor Performance

1. Open Performance tab
2. Record interaction
3. Check frame rate (should be 60fps)
4. Verify no memory leaks

### Test Network

1. Open Network tab
2. Filter by JS files
3. Compare bundle sizes between implementations
4. Check load times

## Share the Demo

The demo is running locally. To share with others:

### Option 1: Use `--host` Flag

```bash
vite --host
```

Access via your local network IP.

### Option 2: Deploy to Vercel/Netlify

```bash
cd demo
bun run build
# Upload dist/ folder
```

### Option 3: ngrok/LocalTunnel

Create public URL for your local server:

```bash
npx localtunnel --port 3000
```

## Feedback

Found issues or have suggestions? File an issue on GitHub!

**Repository**: https://github.com/pie-framework/pie-players

---

**Demo Status**: ✅ Running at http://localhost:3000

**Press Ctrl+C to stop the server**
