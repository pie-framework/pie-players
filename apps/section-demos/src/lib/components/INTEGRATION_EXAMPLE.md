# Integration Example: Unified Assessment Toolkit Settings

## How to Replace TTSSettings with AssessmentToolkitSettings

### Before (separate TTS settings):

```svelte
<script>
  import TTSSettings from '$lib/components/TTSSettings.svelte';

  let showTTSSettings = $state(false);
  let ttsConfig = $state({ /* ... */ });
</script>

<!-- Settings Button -->
<button onclick={() => showTTSSettings = true}>
  TTS Settings
</button>

<!-- Modal -->
{#if showTTSSettings}
  <TTSSettings
    bind:config={ttsConfig}
    onConfigChange={handleTTSConfigChange}
  />
{/if}
```

### After (unified settings):

```svelte
<script>
  import AssessmentToolkitSettings from '$lib/components/AssessmentToolkitSettings.svelte';

  let showSettings = $state(false);

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

  async function handleSettingsApply(settings: any) {
    // Apply TTS settings
    if (settings.tts.provider !== ttsConfig.provider ||
        settings.tts.voice !== ttsConfig.voice) {
      ttsConfig = settings.tts;
      await initializeTTS(ttsConfig);
    } else {
      ttsConfig = settings.tts;
    }

    // Apply highlight settings
    highlightConfig = settings.highlight;

    // Save to localStorage
    localStorage.setItem('toolkit-settings', JSON.stringify(settings));

    // Close modal
    showSettings = false;
  }
</script>

<!-- Settings Button -->
<button onclick={() => showSettings = true}>
  ⚙️ Assessment Settings
</button>

<!-- Unified Settings Modal -->
{#if showSettings}
  <AssessmentToolkitSettings
    {ttsService}
    bind:ttsConfig
    bind:highlightConfig
    onClose={() => showSettings = false}
    onApply={handleSettingsApply}
  />
{/if}
```

## Key Changes in +page.svelte

1. **Replace import:**
   ```diff
   - import TTSSettings from '$lib/components/TTSSettings.svelte';
   + import AssessmentToolkitSettings from '$lib/components/AssessmentToolkitSettings.svelte';
   ```

2. **Update state variables:**
   ```diff
   - let showTTSSettings = $state(false);
   + let showSettings = $state(false);

   + let highlightConfig = $state({
   +   enabled: true,
   +   color: '#ffeb3b',
   +   opacity: 0.4
   + });
   ```

3. **Update button (around line 656):**
   ```diff
   - <button onclick={() => showTTSSettings = true}>
   -   🔊 TTS Settings
   + <button onclick={() => showSettings = true}>
   +   ⚙️ Settings
   ```

4. **Replace modal (around line 924):**
   ```diff
   - {#if showTTSSettings}
   -   <TTSSettings
   -     bind:config={ttsConfig}
   -     onConfigChange={handleTTSConfigChange}
   -   />
   - {/if}
   + {#if showSettings}
   +   <AssessmentToolkitSettings
   +     {ttsService}
   +     bind:ttsConfig
   +     bind:highlightConfig
   +     onClose={() => showSettings = false}
   +     onApply={handleSettingsApply}
   +   />
   + {/if}
   ```

5. **Update handleTTSConfigChange to handleSettingsApply:**
   ```diff
   - async function handleTTSConfigChange(newConfig: TTSConfig) {
   + async function handleSettingsApply(settings: { tts: TTSConfig, highlight: any }) {
   +   const newConfig = settings.tts;
       // Re-initialize if provider or voice changed
       if (newConfig.provider !== ttsConfig.provider || newConfig.voice !== ttsConfig.voice) {
         ttsConfig = newConfig;
         await initializeTTS(newConfig);
       } else {
         ttsConfig = newConfig;
       }
   +
   +   // Apply highlight settings
   +   highlightConfig = settings.highlight;

       // Persist to localStorage
   -   localStorage.setItem(TTS_CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
   +   localStorage.setItem('toolkit-settings', JSON.stringify(settings));
   +
   +   showSettings = false;
     }
   ```

## Benefits of Unified Settings

1. **Single Entry Point**: One settings button/modal for all toolkit features
2. **Consistent UX**: Tabbed interface keeps related settings organized
3. **Extensible**: Easy to add new tabs for future features
4. **Professional**: More polished appearance with better visual design
5. **Future-Proof**: Room for tools, accessibility, and other features

## Tabs Overview

### 🔊 Text-to-Speech
- Provider selection (Polly vs Browser)
- Voice selection with filtered lists
- Engine settings (Neural/Standard for Polly)
- Sample rate configuration
- Rate and pitch sliders
- Voice preview

### ✏️ Highlighting
- Enable/disable toggle
- Color preset selector
- Custom color picker
- Opacity slider
- Live preview

### 🧰 Tools
- Information about available tools
- Future: tool shortcuts, positioning, defaults

### ♿ Accessibility
- Overview of current features
- Roadmap for planned enhancements
- Future: high contrast, font size, keyboard shortcuts

## Migration Checklist

- [ ] Import AssessmentToolkitSettings component
- [ ] Rename showTTSSettings → showSettings
- [ ] Add highlightConfig state
- [ ] Update settings button text/icon
- [ ] Replace TTSSettings component with AssessmentToolkitSettings
- [ ] Update handleTTSConfigChange → handleSettingsApply
- [ ] Add highlight settings persistence
- [ ] Test all tabs and settings
- [ ] Remove old TTSSettings component (optional)
