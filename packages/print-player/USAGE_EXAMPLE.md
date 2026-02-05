# Concrete Example: How Clients Use Print Views Today

This document shows real-world usage of print views from the production pieoneer application.

## Current Architecture (Legacy @pie-framework/pie-print)

### 1. HTML Setup

Clients dynamically load the print player from CDN:

```html
<!-- pieoneer/src/routes/(protected)/item/[[id]]/print/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  let loaded = false;
  let scriptElement: HTMLScriptElement | null = null;

  // Load print player from CDN
  onMount(() => {
    const playerUrl = `https://cdn.jsdelivr.net/npm/@pie-framework/pie-print@2.7.0/lib/pie-print.js`;

    const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
      scriptElement = document.createElement('script');
      scriptElement.src = src;
      scriptElement.type = 'module';
      scriptElement.async = true;
      scriptElement.onload = () => resolve();
      scriptElement.onerror = () => reject(new Error(`Could not load script ${src}`));
      document.head.appendChild(scriptElement);
    });

    loadScript(playerUrl)
      .then(() => {
        loaded = true;
      })
      .catch((error) => {
        console.error('Error loading Pie print item:', error);
      });
  });
</script>

{#if !loaded}
  Loading...
{:else}
  <pie-print config={config}></pie-print>
{/if}
```

### 2. Item Configuration Structure

The `config` object passed to `<pie-print>` has this structure:

```typescript
// Real-world example from pieoneer
const config = {
  item: {
    // HTML markup with element placeholders
    markup: `
      <passage id="passage-1"></passage>
      <multiple-choice id="question-1"></multiple-choice>
      <multiple-choice id="question-2"></multiple-choice>
    `,

    // Map of element tag names to package@version
    elements: {
      'passage': '@pie-element/passage@5.3.3',
      'multiple-choice': '@pie-element/multiple-choice@11.4.3'
    },

    // Array of element configurations
    models: [
      {
        id: 'passage-1',
        element: 'passage',
        text: '<h3>Read the passage below</h3><p>Lorem ipsum...</p>',
        // ... other passage-specific properties
      },
      {
        id: 'question-1',
        element: 'multiple-choice',
        prompt: '<p>Based on the passage, what is the main idea?</p>',
        choiceMode: 'radio',
        choices: [
          {
            label: '<div>Choice A</div>',
            value: 'a',
            correct: false,
            rationale: '<div>This is incorrect because...</div>'
          },
          {
            label: '<div>Choice B</div>',
            value: 'b',
            correct: true,
            rationale: '<div>This is correct because...</div>'
          },
          {
            label: '<div>Choice C</div>',
            value: 'c',
            correct: false
          }
        ],
        rationaleEnabled: true,
        promptEnabled: true,
        choicePrefix: 'letters',
        // ... other multiple-choice properties
      },
      {
        id: 'question-2',
        element: 'multiple-choice',
        // ... similar structure
      }
    ]
  },

  // Options control rendering behavior
  options: {
    role: 'student' // or 'instructor'
  }
};
```

### 3. Role-Based Rendering

The `role` option controls what gets displayed:

```typescript
// Student view - questions only
config.options.role = 'student';
// Result:
// - Shows prompts and choices
// - Hides correct answers
// - Hides rationales
// - All interactions disabled

// Instructor view - answer key
config.options.role = 'instructor';
// Result:
// - Shows prompts and choices
// - Shows correct answers (highlighted)
// - Shows rationales for each choice
// - All interactions disabled
```

### 4. Complete Working Example

Here's a minimal but complete example you can run:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PIE Print Example</title>

  <!-- Load the print player -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/@pie-framework/pie-print@2.7.0/lib/pie-print.js"></script>
</head>
<body>
  <h1>Assessment Print View</h1>

  <!-- Role switcher -->
  <div>
    <label>
      <input type="radio" name="role" value="student" checked onchange="updateRole(this.value)">
      Student View
    </label>
    <label>
      <input type="radio" name="role" value="instructor" onchange="updateRole(this.value)">
      Instructor View (Answer Key)
    </label>
  </div>

  <!-- Print player element -->
  <pie-print id="player"></pie-print>

  <script>
    // Wait for the custom element to be defined
    customElements.whenDefined('pie-print').then(() => {
      const player = document.querySelector('#player');

      // Complete item configuration
      const itemConfig = {
        item: {
          // Markup defines the layout
          markup: `
            <passage id="p1"></passage>
            <multiple-choice id="q1"></multiple-choice>
          `,

          // Elements map tag names to packages
          elements: {
            'passage': '@pie-element/passage@5.3.3',
            'multiple-choice': '@pie-element/multiple-choice@11.4.3'
          },

          // Models provide the data for each element
          models: [
            {
              id: 'p1',
              element: 'passage',
              text: `
                <h3>The Water Cycle</h3>
                <p>Water cycles through different states as it moves through
                the environment. It evaporates from bodies of water, condenses
                into clouds, and falls as precipitation.</p>
              `
            },
            {
              id: 'q1',
              element: 'multiple-choice',
              prompt: '<p>What happens to water during evaporation?</p>',
              choiceMode: 'radio',
              choices: [
                {
                  label: '<div>It turns into ice</div>',
                  value: 'a',
                  correct: false,
                  rationale: '<div>Incorrect. Ice forms during freezing, not evaporation.</div>'
                },
                {
                  label: '<div>It turns into water vapor</div>',
                  value: 'b',
                  correct: true,
                  rationale: '<div>Correct! Evaporation converts liquid water into water vapor.</div>'
                },
                {
                  label: '<div>It turns into clouds</div>',
                  value: 'c',
                  correct: false,
                  rationale: '<div>Incorrect. Clouds form during condensation, not evaporation.</div>'
                }
              ],
              rationaleEnabled: true,
              promptEnabled: true,
              choicePrefix: 'letters'
            }
          ]
        },
        options: {
          role: 'student' // Start with student view
        }
      };

      // Set the configuration
      player.config = itemConfig;

      // Store config globally for role switching
      window.itemConfig = itemConfig;
    });

    // Role switcher function
    function updateRole(role) {
      const player = document.querySelector('#player');
      window.itemConfig.options.role = role;
      // Trigger update by setting config again
      player.config = { ...window.itemConfig };
    }
  </script>
</body>
</html>
```

## What Happens Under the Hood

When you set `player.config = itemConfig`, the print player:

1. **Resolves package URLs**
   ```
   'multiple-choice' → '@pie-element/multiple-choice@11.4.3'
                    → 'https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@11.4.3/module/print.js'
   ```

2. **Loads print modules dynamically**
   ```javascript
   const mod = await import('https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@11.4.3/module/print.js');
   const PrintElement = mod.default;
   ```

3. **Registers custom elements with unique names**
   ```javascript
   customElements.define('multiple-choice-print-123456789', PrintElement);
   ```

4. **Transforms the markup**
   ```html
   <!-- Before -->
   <multiple-choice id="q1"></multiple-choice>

   <!-- After -->
   <multiple-choice-print-123456789 id="q1"></multiple-choice-print-123456789>
   ```

5. **Applies model data to each element**
   ```javascript
   const el = document.querySelector('multiple-choice-print-123456789[id="q1"]');
   el.model = { id: 'q1', element: 'multiple-choice', ... };
   el.options = { role: 'student' };
   ```

6. **Each print element internally**
   - Runs `preparePrintModel()` to transform the model
   - Renders using the delivery component
   - Disables all interactions
   - Shows/hides answers based on role

## Key Differences from Interactive Player

| Aspect | Interactive Player | Print Player |
|--------|-------------------|--------------|
| **Input** | Model + session per element | Full item config with markup |
| **Loading** | Pre-bundled or import maps | Dynamic CDN loading |
| **Registration** | Fixed tag names | Hash-based unique names |
| **Markup** | N/A - direct component use | Parses and transforms HTML |
| **Session** | Live session data | Empty session |
| **Interactivity** | Enabled | Disabled |
| **Role handling** | Via env/mode | Via options.role |

## Migration to @pie-element/print-player

The new print player maintains the same API:

```diff
- <script type="module" src="https://cdn.jsdelivr.net/npm/@pie-framework/pie-print@2.7.0/lib/pie-print.js"></script>
+ <script type="module" src="https://cdn.jsdelivr.net/npm/@pie-element/print-player@1.0.0/dist/print-player.js"></script>
```

The only change needed is the URL resolution for newer packages:

```javascript
player.resolve = (tagName, pkg) => {
  const [_, name, version] = pkg.match(/@pie-element\/(.*?)@(.*)/);
  return Promise.resolve({
    tagName,
    pkg,
    // New path for pie-elements-ng packages
    url: `https://cdn.jsdelivr.net/npm/@pie-element/${name}@${version}/dist/print/index.js`,
    module: true
  });
};
```

Everything else remains identical!
