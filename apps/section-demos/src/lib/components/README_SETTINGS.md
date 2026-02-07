# Unified Assessment Toolkit Settings

A comprehensive, tabbed settings interface for all PIE Assessment Toolkit features.

## Overview

The `AssessmentToolkitSettings` component provides a single, unified interface for configuring all assessment toolkit features including Text-to-Speech, highlighting, tools, and accessibility options.

## Features

### 🎨 Modern UI Design
- Clean, professional tabbed interface
- Responsive design (mobile-friendly)
- Smooth transitions and hover effects
- Accessible keyboard navigation
- High-quality visual feedback

### 📱 Four Main Tabs

#### 1. 🔊 Text-to-Speech
Configure TTS providers and voice settings:
- **Provider Selection**: AWS Polly (premium) or Browser TTS (free)
- **Voice Selection**: Filtered lists based on provider
  - Polly: 10 curated English voices (Neural/Standard)
  - Browser: All available system voices, filtered to English
- **Quality Settings** (Polly):
  - Engine: Neural (best quality) or Standard
  - Sample Rate: 8kHz to 24kHz
- **Playback Controls**:
  - Speech Rate: 0.5x to 2.0x with visual slider
  - Pitch: 0.5x to 2.0x with visual slider
- **Voice Preview**: Test button to hear current settings

#### 2. ✏️ Highlighting
Configure text highlighting appearance:
- **Enable/Disable Toggle**: Turn highlighting on/off
- **Color Selection**:
  - 6 preset colors (Yellow, Green, Blue, Pink, Orange, Purple)
  - Custom color picker for unlimited options
- **Opacity Control**: 10% to 100% transparency slider
- **Live Preview**: See exactly how highlights will appear

#### 3. 🧰 Tools
Overview and future configuration for assessment tools:
- **Current Tools**:
  - 🧮 Calculator (basic & scientific)
  - 📏 Ruler (digital measurement)
  - 📐 Protractor (angle measurement)
  - 📊 Graph (plotting)
  - 🎨 Color Scheme (display options)
- **Planned Features**:
  - Custom tool shortcuts
  - Tool position preferences
  - Default tool states
  - Session persistence

#### 4. ♿ Accessibility
Accessibility features and roadmap:
- **Current Features**:
  - ✓ ARIA labels and landmarks
  - ✓ Keyboard navigation
  - ✓ Focus management
  - ✓ TTS integration
  - ✓ SSML catalog support
  - ✓ Tool coordination
- **Planned Enhancements**:
  - High contrast mode
  - Font size adjustment
  - Line spacing customization
  - Color blind friendly palettes
  - Extended keyboard shortcuts
  - Screen reader optimizations

## Component API

### Props

```typescript
interface Props {
  // TTS Service instance (optional)
  ttsService?: TTSService;

  // TTS Configuration (bindable)
  ttsConfig?: {
    provider: 'polly' | 'browser';
    voice: string;
    rate: number;
    pitch: number;
    pollyEngine?: 'neural' | 'standard';
    pollySampleRate?: number;
  };

  // Highlight Configuration (bindable)
  highlightConfig?: {
    enabled: boolean;
    color: string;
    opacity: number;
  };

  // Event handlers
  onClose?: () => void;
  onApply?: (settings: {
    tts: typeof ttsConfig;
    highlight: typeof highlightConfig;
  }) => void;
}
```

### Events

- **onClose**: Triggered when user clicks Cancel or close button
- **onApply**: Triggered when user clicks Apply Settings with updated config

### Actions

- **Apply Settings**: Commits changes and closes modal
- **Cancel**: Discards changes and closes modal
- **Reset to Defaults**: Restores all settings to default values

## Usage Example

```svelte
<script>
  import AssessmentToolkitSettings from '$lib/components/AssessmentToolkitSettings.svelte';
  import { TTSService } from '@pie-players/pie-assessment-toolkit';

  let showSettings = $state(false);
  let ttsService = new TTSService();

  let ttsConfig = $state({
    provider: 'polly',
    voice: 'Joanna',
    rate: 1.0,
    pitch: 1.0,
    pollyEngine: 'neural',
    pollySampleRate: 24000
  });

  let highlightConfig = $state({
    enabled: true,
    color: '#ffeb3b',
    opacity: 0.4
  });

  async function handleApply(settings) {
    // Re-initialize TTS if needed
    if (settings.tts.provider !== ttsConfig.provider) {
      await initializeTTS(settings.tts);
    }

    // Update configs
    ttsConfig = settings.tts;
    highlightConfig = settings.highlight;

    // Save to localStorage
    localStorage.setItem('settings', JSON.stringify(settings));

    // Close modal
    showSettings = false;
  }
</script>

<button onclick={() => showSettings = true}>
  ⚙️ Settings
</button>

{#if showSettings}
  <AssessmentToolkitSettings
    {ttsService}
    bind:ttsConfig
    bind:highlightConfig
    onClose={() => showSettings = false}
    onApply={handleApply}
  />
{/if}
```

## Design Principles

### 1. **Progressive Disclosure**
Settings are organized into logical tabs, showing only relevant options based on current selections (e.g., Polly-specific settings only show when Polly is selected).

### 2. **Immediate Feedback**
- Sliders show current values in labels
- Color selection shows check mark on active preset
- Preview sections demonstrate how settings will look/sound

### 3. **Sensible Defaults**
- Default to high-quality options (Neural Polly, 24kHz)
- Medium opacity for highlights (40%)
- Normal speech rate and pitch (1.0x)

### 4. **Accessibility First**
- Full keyboard navigation support
- ARIA labels on all interactive elements
- Focus management for modal
- Escape key closes modal

### 5. **Responsive Design**
- Adapts to mobile devices
- Horizontal scrolling tabs on narrow screens
- Stacked buttons in footer on mobile

## Visual Design

### Color Palette
- **Primary Blue**: `#2563eb` (buttons, active states)
- **Borders**: `#e5e7eb` (subtle gray)
- **Text Primary**: `#1f2937` (dark gray)
- **Text Secondary**: `#6b7280` (medium gray)
- **Background**: `white` with `#f9fafb` accents

### Typography
- **Headings**: 600 weight, clear hierarchy
- **Body**: 400-500 weight, 0.95rem base
- **Labels**: 500 weight, slightly smaller

### Spacing
- **Consistent padding**: 1rem to 1.5rem
- **Gap between elements**: 0.75rem to 1.5rem
- **Modal margins**: 1.5rem padding, max-width 800px

### Interactive Elements
- **Hover states**: Subtle background/border color changes
- **Active states**: Bold borders and shadows
- **Transitions**: 0.2s for smooth interactions

## Implementation Notes

### State Management
- Uses Svelte 5 `$state` and `$bindable` for reactivity
- Local copies of config edited until Apply is clicked
- Cancel restores original values by not applying changes

### Voice Loading
- Browser voices loaded asynchronously via `speechSynthesis`
- Polly voices are hardcoded list (most common English voices)
- Automatic filtering to English-only voices for better UX

### Extensibility
- Easy to add new tabs by extending activeTab type and adding content
- New setting groups follow consistent pattern
- Can add more tool/accessibility features as they're implemented

## Future Enhancements

### Short Term
- [ ] Tools tab: actual configuration options
- [ ] Accessibility tab: high contrast mode toggle
- [ ] Keyboard shortcuts customization
- [ ] Import/Export settings

### Long Term
- [ ] Per-assessment override settings
- [ ] User profiles for different students
- [ ] Integration with backend user preferences
- [ ] Analytics on settings usage
- [ ] A/B testing different default configurations

## Performance Considerations

- Modal content lazy-loaded (only renders when open)
- Voice list loaded once and cached
- No unnecessary re-renders via proper Svelte reactivity
- Transitions hardware-accelerated with CSS transforms

## Browser Compatibility

- **Modern browsers**: Full support (Chrome, Firefox, Safari, Edge)
- **Browser TTS**: Requires Web Speech API support
- **Fallback**: AWS Polly available on all browsers
- **Mobile**: Fully responsive, touch-friendly controls

## Accessibility Compliance

- **WCAG 2.2 Level AA** compliant
- **Keyboard navigation**: Tab, Enter, Escape, Arrow keys
- **Screen reader**: Proper ARIA labels and roles
- **Focus management**: Trapped within modal when open
- **Color contrast**: Meets 4.5:1 ratio minimum

## Related Components

- `TTSSettings.svelte` - Previous standalone TTS settings (can be deprecated)
- `PieSectionPlayer.svelte` - Main player that uses these settings
- `TTSService` - Service that applies TTS configuration
- `HighlightCoordinator` - Service that applies highlight configuration

## Questions?

See [INTEGRATION_EXAMPLE.md](./INTEGRATION_EXAMPLE.md) for step-by-step migration guide.
