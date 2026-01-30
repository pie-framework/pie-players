# Math.js Calculator - Accessibility Guide

This document describes the accessibility features of the Math.js calculator implementation and how it achieves WCAG 2.2 Level AA compliance.

## Overview

The Math.js calculator is designed to be fully accessible to users with disabilities, including those who:
- Use screen readers
- Navigate by keyboard only
- Have low vision or use high contrast mode
- Use voice control or other assistive technologies
- Have motor impairments requiring larger touch targets

## WCAG 2.2 Level AA Compliance

### 1. Keyboard Accessibility (2.1.1 - Level A)

**All calculator functions are operable via keyboard.**

#### Keyboard Shortcuts

| Key(s) | Action |
|--------|--------|
| `0-9` | Input digits |
| `+`, `-`, `*`, `/` | Operators |
| `.` | Decimal point |
| `Enter` or `=` | Calculate result |
| `Escape` or `C` | Clear calculator |
| `Backspace` | Delete last character |
| `%` | Percent |

#### Scientific Calculator Additional Shortcuts

| Key | Function |
|-----|----------|
| `S` | Sine |
| `O` | Cosine |
| `T` | Tangent |
| `Q` | Square root |

#### Grid Navigation

The calculator button grid supports arrow key navigation:

| Key | Action |
|-----|--------|
| `↑` `↓` `←` `→` | Navigate between buttons |
| `Home` | Jump to first button in row |
| `End` | Jump to last button in row |
| `Enter` or `Space` | Activate focused button |

### 2. Focus Visibility (2.4.7 - Level AA)

**Focus indicators are clearly visible and meet contrast requirements.**

- 3px solid outline in primary theme color
- 2px offset from button edge
- Z-index elevation to prevent overlap
- Visible in all themes (light, dark, high contrast)

```css
.btn:focus-visible {
  outline: 3px solid hsl(var(--p));
  outline-offset: 2px;
  z-index: 10;
}
```

### 3. Color Contrast (1.4.3 - Level AA)

**All text and UI elements meet minimum contrast ratios.**

| Element | Contrast Ratio | Requirement |
|---------|---------------|-------------|
| Display text | 7:1 | AA (Enhanced) |
| Button labels | 4.5:1+ | AA |
| Operator buttons | 4.5:1+ | AA |
| Error messages | 4.5:1+ | AA |
| Focus indicators | 3:1+ | AA |

DaisyUI themes automatically provide proper contrast ratios.

### 4. Non-text Contrast (1.4.11 - Level AA)

**UI components have 3:1 contrast against adjacent colors.**

- Button borders: 3:1+ contrast
- Display area border: 3:1+ contrast
- Focus indicators: 3:1+ contrast

### 5. Text Alternatives (1.1.1 - Level A)

**All buttons have accessible names.**

Symbol buttons include descriptive aria-labels:

```html
<button aria-label="Divide">÷</button>
<button aria-label="Multiply">×</button>
<button aria-label="Subtract">−</button>
<button aria-label="Add">+</button>
<button aria-label="Plus minus">±</button>
<button aria-label="Square root">√</button>
<button aria-label="Pi">π</button>
```

### 6. Error Identification (3.3.1 - Level A)

**Errors are identified and described in text.**

Error messages include:
- Visual alert component (DaisyUI)
- Error icon
- Descriptive text message
- Screen reader announcement

```html
<div role="alert" aria-live="assertive" class="alert alert-error">
  <svg>...</svg>
  <span>Cannot divide by zero</span>
</div>
```

Error types:
- "Cannot divide by zero"
- "Result is too large"
- "Invalid expression"

### 7. Error Suggestions (3.3.3 - Level AA)

**Error messages provide context and guidance.**

Each error message:
- Explains what went wrong
- Is automatically announced to screen readers
- Auto-dismisses after 5 seconds
- Resets calculator to valid state

### 8. Status Messages (4.1.3 - Level AA)

**Calculator operations are announced to screen readers.**

Live regions announce:
- Button presses ("7", "Plus", "Equals")
- Calculation results ("Result: 15")
- Memory operations ("Added 5 to memory")
- Angle mode changes ("Angle mode: degrees")
- Clear operations ("Cleared")

```html
<div class="sr-only" aria-live="polite" aria-atomic="true">
  <!-- Screen reader announcements appear here -->
</div>
```

### 9. Touch Target Size (2.5.5 - Level AAA)

**While not required for Level AA, we exceed AAA standards.**

- Mobile/touch: 48x48px minimum
- Desktop: 48x48px (exceeds 24px minimum)
- Proper spacing between buttons (8px gap)

```css
.btn-lg {
  min-height: 48px;
  min-width: 48px;
}
```

## ARIA Implementation

### Semantic Structure

```html
<div role="dialog" aria-label="Scientific Calculator" aria-describedby="calc-instructions">
  <!-- Screen reader instructions -->
  <div id="calc-instructions" class="sr-only">
    Use arrow keys to navigate between buttons.
    Press Enter or Space to activate a button.
  </div>

  <!-- Display region -->
  <div role="region" aria-label="Calculator display">
    <div role="log" aria-live="polite"><!-- History --></div>
    <input role="textbox" aria-live="assertive" readonly />
  </div>

  <!-- Button grid -->
  <div role="grid" aria-label="Calculator buttons">
    <div role="row">
      <button role="gridcell">...</button>
    </div>
  </div>
</div>
```

### ARIA Grid Pattern

The calculator uses the [W3C ARIA Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) for button navigation:

- **role="grid"**: Container for button grid
- **role="row"**: Each row of buttons
- **role="gridcell"**: Each button
- **aria-activedescendant**: Tracks focus in grid
- **tabindex="0"**: Makes grid focusable

### Live Regions

Three types of live regions:

1. **History (polite)**: Calculation history updates
   - `role="log"`
   - `aria-live="polite"` - doesn't interrupt

2. **Display (assertive)**: Current value changes
   - `role="textbox"`
   - `aria-live="assertive"` - announces immediately

3. **Status (polite)**: Operation announcements
   - Hidden div for screen readers
   - `aria-live="polite"`

4. **Errors (assertive)**: Error messages
   - `role="alert"`
   - `aria-live="assertive"` - interrupts for urgency

## High Contrast Mode Support

### CSS Media Queries

```css
/* High contrast preference */
@media (prefers-contrast: high) {
  .btn {
    border: 2px solid currentColor;
  }
}

/* Windows High Contrast Mode */
@media (forced-colors: active) {
  .btn {
    border: 2px solid ButtonText;
  }
  .btn:focus {
    outline: 3px solid Highlight;
  }
}
```

### Theme Support

The calculator respects:
- System theme preference (`prefers-color-scheme`)
- DaisyUI theme configuration
- High contrast mode
- Forced colors mode (Windows)

## Screen Reader Testing

### Tested With

- ✅ NVDA (Windows)
- ✅ JAWS (Windows)
- ✅ VoiceOver (macOS/iOS)
- ✅ TalkBack (Android)

### Expected Screen Reader Behavior

1. **Opening calculator**:
   - "Scientific Calculator dialog"
   - Instructions read automatically

2. **Navigating buttons**:
   - "Seven, button"
   - "Add, button"
   - "Equals, button"

3. **Performing calculation**:
   - Press 2: "2"
   - Press +: "Plus"
   - Press 3: "3"
   - Press =: "Result: 5"

4. **Error handling**:
   - Division by zero: "Alert: Cannot divide by zero"

5. **Memory operations**:
   - M+: "Added 5 to memory"
   - MR: "Recalled 5 from memory"

## Reduced Motion Support

Respects `prefers-reduced-motion` preference:

```css
@media (prefers-reduced-motion: reduce) {
  .btn {
    transition: none;
  }
  .btn:active {
    animation: none;
  }
}
```

## Focus Management

### Focus Trap

When calculator opens in modal/dialog mode:
- Focus moves to first button
- Tab cycles within calculator
- Escape closes and returns focus

### Focus Restoration

When calculator closes:
- Focus returns to trigger element
- Keyboard navigation continues seamlessly

## DaisyUI Integration

### Accessible Components Used

- **Card**: Semantic container with proper regions
- **Alert**: WCAG-compliant error messages
- **Button**: Built-in focus states and contrast
- **Input**: Accessible display field

### Theme Compatibility

Works with all DaisyUI themes:
- Light themes
- Dark themes
- High contrast themes
- Custom themes

Automatic contrast adjustment ensures accessibility across all themes.

## Best Practices Implemented

### 1. Progressive Enhancement
- Works without JavaScript (graceful degradation)
- Touch, mouse, and keyboard support
- Responsive design (mobile to desktop)

### 2. User Preferences
- Respects system theme
- Honors reduced motion
- Supports high contrast
- Adapts to screen size

### 3. Clear Feedback
- Visual button press animation
- Screen reader announcements
- Error messages with context
- State indicators (memory, angle mode)

### 4. Consistent Behavior
- Standard keyboard shortcuts
- Predictable button layout
- Industry-standard calculator design
- Familiar interaction patterns

## Testing Checklist

Use this checklist to verify accessibility:

### Keyboard Navigation
- [ ] All buttons reachable via Tab
- [ ] Arrow keys navigate grid
- [ ] Enter/Space activate buttons
- [ ] Escape closes calculator
- [ ] Number keys work directly
- [ ] Operator keys work directly

### Screen Reader
- [ ] Calculator role announced
- [ ] Instructions read on focus
- [ ] Button labels spoken
- [ ] Operations announced
- [ ] Results announced
- [ ] Errors announced

### Visual
- [ ] Focus indicators visible
- [ ] Contrast ratios sufficient
- [ ] Text readable at 200% zoom
- [ ] High contrast mode works
- [ ] Dark mode accessible

### Touch/Mobile
- [ ] Buttons minimum 48x48px
- [ ] Adequate spacing
- [ ] Touch targets not overlapping
- [ ] Gestures optional, not required

## Resources

- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Calculator Tutorial](https://webaim.org/articles/calculator/)
- [DaisyUI Accessibility](https://daisyui.com/docs/features/#accessibility)

## Support

For accessibility issues or questions:
- File an issue on GitHub
- Include browser/screen reader details
- Describe expected vs actual behavior
- Note WCAG success criterion if applicable
