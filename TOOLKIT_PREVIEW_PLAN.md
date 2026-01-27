# Assessment Toolkit Preview Section - Implementation Plan

## Overview

Build a comprehensive preview and debugging section for the PIE assessment toolkit that serves three audiences:
1. **Developers** - Debugging, testing toolkit features, event inspection
2. **UX Professionals** - Testing layouts, interactions, navigation patterns
3. **Accessibility Professionals** - Testing accommodations, profiles, WCAG compliance

## Architecture

### Route Structure

```
/toolkit-preview/
├── +layout.svelte              # Layout with profile editor sidebar
├── +page.svelte                # Landing/overview page
└── /[elementType]/
    └── +page.svelte            # Individual element type preview
```

**Element Type Routes:**
- `multiple-choice` - Basic and multi-select MC
- `true-false` - Boolean selection
- `constructed-response` - Text entry (short and extended)
- `math` - Equation editor, graphing, number line, fraction models
- `matching` - Item-to-item matching
- `categorization` - Grouping/sorting
- `drag-drop` - Fill blanks, image-based
- `hotspot` - Clickable area selection
- `drawing` - Canvas-based drawing
- `inline-dropdown` - In-line select elements
- `select-text` - Passage highlighting
- `charting` - Data visualization
- `rubric` - Complex scoring rubrics

### Component Architecture

```
/apps/example/src/routes/toolkit-preview/
├── +layout.svelte              # Main layout wrapper
├── +page.svelte                # Landing page
├── ProfileEditor.svelte        # Editable profile sidebar
├── DebugPanel.svelte           # Event log and dev tools
├── PlayerContainer.svelte      # Assessment player wrapper
└── /[elementType]/
    └── +page.svelte            # Element-specific assessment
```

### Data Flow

```
┌─────────────────┐
│  Profile Editor │ ──(profile)──> ┌──────────────────┐
└─────────────────┘                 │ Assessment Player│
                                    │  with Reference  │
┌─────────────────┐                 │      Layout      │
│  Element Type   │ ──(itemBank)──> └──────────────────┘
│   Selection     │                          │
└─────────────────┘                          │
                                             │(events)
┌─────────────────┐                          │
│   Debug Panel   │ <────────────────────────┘
└─────────────────┘
```

## Feature Requirements

### 1. Profile Editor (Left Sidebar - 360px)

**Visual Design:**
- Collapsible sections using DaisyUI accordions
- Live editing with immediate preview
- JSON view/edit option for advanced users
- Pre-built profile templates

**Sections:**

#### A. Student Accommodations
```typescript
interface StudentAccommodations {
  // IEP/504 Requirements (locked)
  iep?: {
    textToSpeech: boolean;
    extendedTime: number; // 1.0 = 100%, 1.5 = 150%
    colorScheme: 'highContrast' | 'lowContrast' | 'standard';
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
    screenReader: boolean;
    answerMasking: boolean;
  };

  // Student Preferences (chooseable)
  preferences?: {
    calculator: boolean;
    notepad: boolean;
    ruler: boolean;
    protractor: boolean;
    highlighter: boolean;
  };
}
```

#### B. Item Configuration
```typescript
interface ItemConfiguration {
  // Required tools for this item
  requiredTools?: string[];

  // Blocked tools for this item
  blockedTools?: string[];

  // Item-specific settings
  allowedInteractionCount?: number;
  shuffleChoices?: boolean;
}
```

#### C. Assessment Defaults
```typescript
interface AssessmentDefaults {
  subject: 'math' | 'ela' | 'science' | 'socialStudies';
  gradeLevel: 'K' | '1-2' | '3-5' | '6-8' | '9-12';

  // Default available tools
  defaultTools: {
    calculator?: 'basic' | 'scientific' | 'graphing';
    protractor?: boolean;
    ruler?: boolean;
    periodicTable?: boolean;
    graph?: boolean;
  };
}
```

#### D. District Policies
```typescript
interface DistrictPolicies {
  // Globally blocked tools
  blockedTools?: string[];

  // Required tools for all assessments
  requiredTools?: string[];

  // Accessibility minimums
  wcagLevel: 'A' | 'AA' | 'AAA';
  keyboardNavigationRequired: boolean;
}
```

**Profile Templates (Dropdown):**
1. **Default Student** - No accommodations, standard tools
2. **IEP - Visual** - High contrast, large font, TTS
3. **IEP - Motor** - Extended time, answer eliminator, highlighter
4. **Section 504** - TTS, extended time (1.5x)
5. **ELL Support** - Dictionary, translation tools
6. **Math Assessment** - Calculator, protractor, ruler, graph
7. **Science Lab** - Periodic table, calculator, graph
8. **No Accommodations** - Minimal tools, standard settings
9. **Full Accessibility** - All accommodations enabled
10. **Custom** - User-defined (editable)

**Editor Features:**
- **Reset Button** - Restore to template default
- **Copy JSON** - Copy profile to clipboard
- **Paste JSON** - Load profile from clipboard
- **Save Preset** - Save to localStorage
- **Load Preset** - Restore from localStorage
- **Validation** - Real-time validation with error messages

### 2. Assessment Player (Center - Flexible Width)

**Layout:**
- Use existing reference layout components from `/packages/assessment-toolkit/src/reference-layout/`
- SchoolCity-like appearance (matching `/assessment/+page.svelte`)
- Responsive breakpoints (desktop, tablet, mobile)

**Player Configuration:**
```svelte
<pie-assessment-player
  assessment={currentAssessment}
  itemBank={currentItemBank}
  profile={editedProfile}
  mode="gather"
  role="student"
  class="block h-full"
  on:player:session-changed={handleSessionChanged}
  on:nav:next-requested={handleNavigation}
  on:tool:opened={handleToolOpened}
  on:a11y:focus-changed={handleFocusChanged}
/>
```

**Assessment Structure (Single Item):**
```typescript
const assessment: AssessmentEntity = {
  id: `preview-${elementType}`,
  name: `${elementType} Preview`,
  testParts: [{
    identifier: 'main',
    navigationMode: 'nonlinear',
    submissionMode: 'individual',
    sections: [{
      identifier: 'items',
      questionRefs: [{
        identifier: 'q1',
        itemVId: elementTypeExampleId
      }]
    }]
  }]
};
```

**Item Bank:**
- Reuse examples from `/apps/example/src/lib/sample-library/pie-examples.ts`
- One representative example per element type
- Include instructions and sample content

### 3. Debug Panel (Right Sidebar - 400px, Collapsible)

**Visual Design:**
- Collapsible with toggle button
- Tabs for different debug views
- Monospace font for technical data
- Auto-scroll to latest event

**Tabs:**

#### A. Event Log
```typescript
interface EventLogEntry {
  timestamp: Date;
  type: string; // 'player:session-changed', 'nav:next-requested', etc.
  source: string; // 'player', 'tool', 'profile'
  data: any;
}
```

**Features:**
- Live event stream
- Filter by event type
- Search within events
- Copy event JSON
- Clear log button
- Export to file

#### B. Profile Resolution
```typescript
interface ResolutionTrace {
  finalProfile: AssessmentContextProfile;

  resolutionSteps: [{
    stage: string; // 'district', 'assessment', 'student', 'item'
    appliedRules: string[];
    changes: { [key: string]: { before: any, after: any } };
  }];

  conflicts: [{
    rule1: string;
    rule2: string;
    resolution: string;
    winner: string;
  }];
}
```

**Display:**
- Visual tree showing precedence
- Highlight conflicts in red
- Show which rules "won"
- Explain resolution logic

#### C. Accessibility Audit
```typescript
interface A11yAudit {
  wcagLevel: 'A' | 'AA' | 'AAA';

  checks: [{
    criterion: string; // '1.4.3 Contrast (Minimum)'
    level: 'A' | 'AA' | 'AAA';
    status: 'pass' | 'fail' | 'warning' | 'na';
    message: string;
    element?: string; // CSS selector
  }];

  keyboardNavigation: {
    allFocusable: boolean;
    tabOrder: string[];
    trapIssues: string[];
    skipLinks: boolean;
  };

  screenReaderSupport: {
    ariaLabels: number;
    altText: number;
    headingStructure: string[];
    landmarkRegions: string[];
  };
}
```

**Features:**
- Run audit on demand
- Filter by level (A, AA, AAA)
- Filter by status (pass, fail, warning)
- Click to highlight element
- Export report

#### D. Performance Metrics
```typescript
interface PerformanceMetrics {
  rendering: {
    initialRender: number; // ms
    profileChange: number; // ms
    itemLoad: number; // ms
  };

  interactions: {
    toolOpen: number; // ms
    responseChange: number; // ms
    navigation: number; // ms
  };

  memory: {
    heapUsed: number; // MB
    itemBankSize: number; // MB
  };
}
```

### 4. Navigation Structure

**Main App Integration:**

Update [/apps/example/src/routes/+layout.svelte](/apps/example/src/routes/+layout.svelte) to add:

```svelte
<li>
  <a href="{base}/toolkit-preview" class="btn btn-ghost btn-sm">
    🛠️ Toolkit Preview
  </a>
</li>
```

**Landing Page** (`/toolkit-preview/+page.svelte`):

Grid of cards (similar to home page):
```
┌─────────────────┬─────────────────┬─────────────────┐
│ Multiple Choice │   True/False    │ Constructed Resp│
├─────────────────┼─────────────────┼─────────────────┤
│      Math       │    Matching     │ Categorization  │
├─────────────────┼─────────────────┼─────────────────┤
│   Drag & Drop   │    Hotspot      │    Drawing      │
└─────────────────┴─────────────────┴─────────────────┘
```

Each card:
- Element type icon
- Name and description
- "Preview" button → `/toolkit-preview/[elementType]`
- Count of available examples

**Element Type Page** (`/toolkit-preview/[elementType]/+page.svelte`):

```
┌────────────┬──────────────────────────────────┬──────────┐
│            │                                  │          │
│  Profile   │     Assessment Player            │  Debug   │
│  Editor    │     (Reference Layout)           │  Panel   │
│            │                                  │  (tabs)  │
│  (edit)    │                                  │          │
│            │                                  │          │
└────────────┴──────────────────────────────────┴──────────┘
```

**Keyboard Navigation:**
- `Ctrl+E` - Toggle profile editor
- `Ctrl+D` - Toggle debug panel
- `Ctrl+K` - Focus search (within debug panel)
- `Ctrl+R` - Reset profile
- `Ctrl+,` - Previous element type
- `Ctrl+.` - Next element type

### 5. Profile Editor Implementation Details

**Component Structure:**

```svelte
<!-- ProfileEditor.svelte -->
<script lang="ts">
  import { writable } from 'svelte/store';
  import type { AssessmentContextProfile } from '@pie-players/pie-assessment-toolkit';
  import { DefaultProfileResolver } from '@pie-players/pie-assessment-toolkit/profile';

  export let profile: AssessmentContextProfile;
  export let onProfileChange: (profile: AssessmentContextProfile) => void;

  let selectedTemplate = 'default';
  let editMode: 'visual' | 'json' = 'visual';
  let jsonError: string | null = null;

  // Profile templates
  const templates = {
    'default': { /* ... */ },
    'iep-visual': { /* ... */ },
    'iep-motor': { /* ... */ },
    // ... etc
  };

  function loadTemplate(name: string) {
    profile = templates[name];
    onProfileChange(profile);
  }

  function resetProfile() {
    loadTemplate(selectedTemplate);
  }

  function copyJSON() {
    navigator.clipboard.writeText(JSON.stringify(profile, null, 2));
  }

  function pasteJSON() {
    navigator.clipboard.readText().then(text => {
      try {
        profile = JSON.parse(text);
        jsonError = null;
        onProfileChange(profile);
      } catch (e) {
        jsonError = e.message;
      }
    });
  }
</script>

<div class="w-[360px] h-full overflow-y-auto bg-base-200 p-4">
  <!-- Template Selector -->
  <div class="form-control mb-4">
    <label class="label">
      <span class="label-text font-semibold">Profile Template</span>
    </label>
    <select
      class="select select-bordered select-sm"
      bind:value={selectedTemplate}
      on:change={() => loadTemplate(selectedTemplate)}
    >
      <option value="default">Default Student</option>
      <option value="iep-visual">IEP - Visual</option>
      <option value="iep-motor">IEP - Motor</option>
      <!-- ... -->
    </select>
  </div>

  <!-- Mode Toggle -->
  <div class="tabs tabs-boxed mb-4">
    <button
      class="tab"
      class:tab-active={editMode === 'visual'}
      on:click={() => editMode = 'visual'}
    >
      Visual
    </button>
    <button
      class="tab"
      class:tab-active={editMode === 'json'}
      on:click={() => editMode = 'json'}
    >
      JSON
    </button>
  </div>

  {#if editMode === 'visual'}
    <!-- Student Accommodations Section -->
    <div class="collapse collapse-arrow bg-base-100 mb-2">
      <input type="checkbox" checked />
      <div class="collapse-title font-medium">
        Student Accommodations
      </div>
      <div class="collapse-content">
        <!-- IEP/504 (locked) -->
        <div class="form-control">
          <label class="label cursor-pointer">
            <span class="label-text">Text-to-Speech (IEP)</span>
            <input
              type="checkbox"
              class="toggle toggle-primary"
              bind:checked={profile.accessibility.textToSpeech.enabled}
              on:change={() => onProfileChange(profile)}
            />
          </label>
        </div>

        <!-- Extended Time -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Extended Time Multiplier</span>
          </label>
          <input
            type="range"
            min="1"
            max="2"
            step="0.25"
            class="range range-sm"
            bind:value={profile.timing.extendedTimeMultiplier}
            on:change={() => onProfileChange(profile)}
          />
          <div class="text-xs text-center mt-1">
            {profile.timing.extendedTimeMultiplier}x
          </div>
        </div>

        <!-- Color Scheme -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Color Scheme</span>
          </label>
          <select
            class="select select-bordered select-sm"
            bind:value={profile.theme.colorScheme}
            on:change={() => onProfileChange(profile)}
          >
            <option value="standard">Standard</option>
            <option value="highContrast">High Contrast</option>
            <option value="lowContrast">Low Contrast</option>
          </select>
        </div>

        <!-- Font Size -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Font Size</span>
          </label>
          <div class="btn-group">
            <button
              class="btn btn-sm"
              class:btn-active={profile.theme.fontSize === 'small'}
              on:click={() => { profile.theme.fontSize = 'small'; onProfileChange(profile); }}
            >
              S
            </button>
            <button
              class="btn btn-sm"
              class:btn-active={profile.theme.fontSize === 'medium'}
              on:click={() => { profile.theme.fontSize = 'medium'; onProfileChange(profile); }}
            >
              M
            </button>
            <button
              class="btn btn-sm"
              class:btn-active={profile.theme.fontSize === 'large'}
              on:click={() => { profile.theme.fontSize = 'large'; onProfileChange(profile); }}
            >
              L
            </button>
            <button
              class="btn btn-sm"
              class:btn-active={profile.theme.fontSize === 'xlarge'}
              on:click={() => { profile.theme.fontSize = 'xlarge'; onProfileChange(profile); }}
            >
              XL
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tools Section -->
    <div class="collapse collapse-arrow bg-base-100 mb-2">
      <input type="checkbox" />
      <div class="collapse-title font-medium">
        Available Tools
      </div>
      <div class="collapse-content">
        <!-- Calculator -->
        <div class="form-control">
          <label class="label cursor-pointer">
            <span class="label-text">Calculator</span>
            <select
              class="select select-bordered select-sm"
              bind:value={profile.tools.calculator}
              on:change={() => onProfileChange(profile)}
            >
              <option value="none">None</option>
              <option value="basic">Basic</option>
              <option value="scientific">Scientific</option>
              <option value="graphing">Graphing</option>
            </select>
          </label>
        </div>

        <!-- Other Tools (checkboxes) -->
        {#each ['protractor', 'ruler', 'periodicTable', 'highlighter', 'notepad'] as tool}
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">{tool}</span>
              <input
                type="checkbox"
                class="toggle toggle-sm"
                bind:checked={profile.tools[tool]}
                on:change={() => onProfileChange(profile)}
              />
            </label>
          </div>
        {/each}
      </div>
    </div>

    <!-- Assessment Defaults Section -->
    <div class="collapse collapse-arrow bg-base-100 mb-2">
      <input type="checkbox" />
      <div class="collapse-title font-medium">
        Assessment Settings
      </div>
      <div class="collapse-content">
        <div class="form-control">
          <label class="label">
            <span class="label-text">Subject</span>
          </label>
          <select
            class="select select-bordered select-sm"
            bind:value={profile.assessment.subject}
            on:change={() => onProfileChange(profile)}
          >
            <option value="math">Math</option>
            <option value="ela">ELA</option>
            <option value="science">Science</option>
            <option value="socialStudies">Social Studies</option>
          </select>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Grade Level</span>
          </label>
          <select
            class="select select-bordered select-sm"
            bind:value={profile.assessment.gradeLevel}
            on:change={() => onProfileChange(profile)}
          >
            <option value="K">Kindergarten</option>
            <option value="1-2">Grades 1-2</option>
            <option value="3-5">Grades 3-5</option>
            <option value="6-8">Grades 6-8</option>
            <option value="9-12">Grades 9-12</option>
          </select>
        </div>
      </div>
    </div>

    <!-- District Policies Section -->
    <div class="collapse collapse-arrow bg-base-100 mb-2">
      <input type="checkbox" />
      <div class="collapse-title font-medium">
        District Policies
      </div>
      <div class="collapse-content">
        <div class="form-control">
          <label class="label">
            <span class="label-text">WCAG Level</span>
          </label>
          <select
            class="select select-bordered select-sm"
            bind:value={profile.district.wcagLevel}
            on:change={() => onProfileChange(profile)}
          >
            <option value="A">Level A</option>
            <option value="AA">Level AA</option>
            <option value="AAA">Level AAA</option>
          </select>
        </div>

        <div class="form-control">
          <label class="label cursor-pointer">
            <span class="label-text">Keyboard Navigation Required</span>
            <input
              type="checkbox"
              class="toggle toggle-sm"
              bind:checked={profile.district.keyboardNavigationRequired}
              on:change={() => onProfileChange(profile)}
            />
          </label>
        </div>
      </div>
    </div>
  {:else}
    <!-- JSON Editor -->
    <div class="form-control">
      <textarea
        class="textarea textarea-bordered font-mono text-xs h-96"
        bind:value={profile}
        on:change={() => onProfileChange(profile)}
      />
      {#if jsonError}
        <div class="alert alert-error mt-2">
          <span class="text-xs">{jsonError}</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Action Buttons -->
  <div class="flex gap-2 mt-4">
    <button class="btn btn-sm flex-1" on:click={resetProfile}>
      Reset
    </button>
    <button class="btn btn-sm flex-1" on:click={copyJSON}>
      Copy JSON
    </button>
    <button class="btn btn-sm flex-1" on:click={pasteJSON}>
      Paste JSON
    </button>
  </div>
</div>
```

### 6. Debug Panel Implementation Details

```svelte
<!-- DebugPanel.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { EventLogEntry, ResolutionTrace, A11yAudit, PerformanceMetrics } from './types';

  export let events: EventLogEntry[] = [];
  export let profile: AssessmentContextProfile;
  export let playerElement: HTMLElement | null = null;

  let activeTab: 'events' | 'profile' | 'a11y' | 'performance' = 'events';
  let eventFilter = '';
  let autoScroll = true;

  // Event Log
  let eventLogContainer: HTMLElement;
  $: if (autoScroll && eventLogContainer) {
    eventLogContainer.scrollTop = eventLogContainer.scrollHeight;
  }

  function clearEvents() {
    events = [];
  }

  function exportEvents() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${Date.now()}.json`;
    a.click();
  }

  // Profile Resolution
  let resolutionTrace: ResolutionTrace;
  $: resolutionTrace = resolveProfile(profile);

  function resolveProfile(profile: AssessmentContextProfile): ResolutionTrace {
    // Analyze profile resolution steps
    // This would use the ProfileResolver to trace decision-making
    return {
      finalProfile: profile,
      resolutionSteps: [],
      conflicts: []
    };
  }

  // A11y Audit
  let a11yAudit: A11yAudit | null = null;

  async function runA11yAudit() {
    if (!playerElement) return;

    // Run accessibility checks
    // Could integrate with axe-core or similar
    a11yAudit = {
      wcagLevel: 'AA',
      checks: [],
      keyboardNavigation: {
        allFocusable: true,
        tabOrder: [],
        trapIssues: [],
        skipLinks: true
      },
      screenReaderSupport: {
        ariaLabels: 0,
        altText: 0,
        headingStructure: [],
        landmarkRegions: []
      }
    };
  }

  // Performance Metrics
  let performanceMetrics: PerformanceMetrics = {
    rendering: { initialRender: 0, profileChange: 0, itemLoad: 0 },
    interactions: { toolOpen: 0, responseChange: 0, navigation: 0 },
    memory: { heapUsed: 0, itemBankSize: 0 }
  };

  onMount(() => {
    // Monitor performance
    if (performance.memory) {
      performanceMetrics.memory.heapUsed = performance.memory.usedJSHeapSize / 1024 / 1024;
    }
  });
</script>

<div class="w-[400px] h-full flex flex-col bg-base-200">
  <!-- Tabs -->
  <div class="tabs tabs-boxed p-2">
    <button
      class="tab tab-sm flex-1"
      class:tab-active={activeTab === 'events'}
      on:click={() => activeTab = 'events'}
    >
      Events
    </button>
    <button
      class="tab tab-sm flex-1"
      class:tab-active={activeTab === 'profile'}
      on:click={() => activeTab = 'profile'}
    >
      Profile
    </button>
    <button
      class="tab tab-sm flex-1"
      class:tab-active={activeTab === 'a11y'}
      on:click={() => activeTab = 'a11y'}
    >
      A11y
    </button>
    <button
      class="tab tab-sm flex-1"
      class:tab-active={activeTab === 'performance'}
      on:click={() => activeTab = 'performance'}
    >
      Perf
    </button>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-hidden">
    {#if activeTab === 'events'}
      <div class="flex flex-col h-full">
        <!-- Controls -->
        <div class="p-2 bg-base-300 flex gap-2">
          <input
            type="text"
            placeholder="Filter events..."
            class="input input-sm flex-1"
            bind:value={eventFilter}
          />
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              bind:checked={autoScroll}
            />
            <span class="label-text ml-1 text-xs">Auto</span>
          </label>
          <button class="btn btn-sm" on:click={clearEvents}>Clear</button>
          <button class="btn btn-sm" on:click={exportEvents}>Export</button>
        </div>

        <!-- Event List -->
        <div
          class="flex-1 overflow-y-auto p-2 font-mono text-xs"
          bind:this={eventLogContainer}
        >
          {#each events.filter(e => !eventFilter || e.type.includes(eventFilter)) as event}
            <div class="mb-2 p-2 bg-base-100 rounded">
              <div class="flex justify-between mb-1">
                <span class="font-semibold text-primary">{event.type}</span>
                <span class="text-base-content/60">
                  {event.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div class="text-base-content/80">
                <pre>{JSON.stringify(event.data, null, 2)}</pre>
              </div>
            </div>
          {/each}
        </div>
      </div>

    {:else if activeTab === 'profile'}
      <div class="overflow-y-auto h-full p-4">
        <h3 class="font-semibold mb-2">Profile Resolution Trace</h3>

        <!-- Resolution Steps -->
        {#each resolutionTrace.resolutionSteps as step}
          <div class="mb-4 p-2 bg-base-100 rounded">
            <div class="font-semibold">{step.stage}</div>
            <ul class="text-xs mt-1">
              {#each step.appliedRules as rule}
                <li>✓ {rule}</li>
              {/each}
            </ul>
          </div>
        {/each}

        <!-- Conflicts -->
        {#if resolutionTrace.conflicts.length > 0}
          <h3 class="font-semibold mb-2 text-error">Conflicts</h3>
          {#each resolutionTrace.conflicts as conflict}
            <div class="mb-2 p-2 bg-error/10 rounded">
              <div class="text-xs">
                <strong>{conflict.rule1}</strong> vs <strong>{conflict.rule2}</strong>
              </div>
              <div class="text-xs mt-1">
                Winner: <span class="font-semibold">{conflict.winner}</span>
              </div>
              <div class="text-xs text-base-content/60">{conflict.resolution}</div>
            </div>
          {/each}
        {/if}

        <!-- Final Profile (JSON) -->
        <h3 class="font-semibold mb-2 mt-4">Final Profile</h3>
        <pre class="text-xs bg-base-100 p-2 rounded overflow-x-auto">
{JSON.stringify(resolutionTrace.finalProfile, null, 2)}
        </pre>
      </div>

    {:else if activeTab === 'a11y'}
      <div class="overflow-y-auto h-full p-4">
        <div class="flex justify-between mb-4">
          <h3 class="font-semibold">Accessibility Audit</h3>
          <button class="btn btn-sm btn-primary" on:click={runA11yAudit}>
            Run Audit
          </button>
        </div>

        {#if a11yAudit}
          <!-- Summary -->
          <div class="stats stats-vertical lg:stats-horizontal shadow mb-4 w-full">
            <div class="stat">
              <div class="stat-title">WCAG Level</div>
              <div class="stat-value text-2xl">{a11yAudit.wcagLevel}</div>
            </div>
            <div class="stat">
              <div class="stat-title">Checks</div>
              <div class="stat-value text-2xl">{a11yAudit.checks.length}</div>
            </div>
          </div>

          <!-- Checks -->
          {#each a11yAudit.checks as check}
            <div
              class="mb-2 p-2 rounded"
              class:bg-success/10={check.status === 'pass'}
              class:bg-error/10={check.status === 'fail'}
              class:bg-warning/10={check.status === 'warning'}
            >
              <div class="flex justify-between">
                <span class="font-semibold text-sm">{check.criterion}</span>
                <span class="badge badge-sm">
                  {check.status.toUpperCase()}
                </span>
              </div>
              <div class="text-xs mt-1">{check.message}</div>
              {#if check.element}
                <div class="text-xs text-base-content/60 mt-1">
                  Element: <code>{check.element}</code>
                </div>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="text-center text-base-content/60 mt-8">
            Click "Run Audit" to perform accessibility checks
          </div>
        {/if}
      </div>

    {:else if activeTab === 'performance'}
      <div class="overflow-y-auto h-full p-4">
        <h3 class="font-semibold mb-4">Performance Metrics</h3>

        <!-- Rendering -->
        <div class="mb-4">
          <h4 class="font-semibold text-sm mb-2">Rendering</h4>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span>Initial Render:</span>
              <span class="font-mono">{performanceMetrics.rendering.initialRender}ms</span>
            </div>
            <div class="flex justify-between">
              <span>Profile Change:</span>
              <span class="font-mono">{performanceMetrics.rendering.profileChange}ms</span>
            </div>
            <div class="flex justify-between">
              <span>Item Load:</span>
              <span class="font-mono">{performanceMetrics.rendering.itemLoad}ms</span>
            </div>
          </div>
        </div>

        <!-- Interactions -->
        <div class="mb-4">
          <h4 class="font-semibold text-sm mb-2">Interactions</h4>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span>Tool Open:</span>
              <span class="font-mono">{performanceMetrics.interactions.toolOpen}ms</span>
            </div>
            <div class="flex justify-between">
              <span>Response Change:</span>
              <span class="font-mono">{performanceMetrics.interactions.responseChange}ms</span>
            </div>
            <div class="flex justify-between">
              <span>Navigation:</span>
              <span class="font-mono">{performanceMetrics.interactions.navigation}ms</span>
            </div>
          </div>
        </div>

        <!-- Memory -->
        <div class="mb-4">
          <h4 class="font-semibold text-sm mb-2">Memory</h4>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span>Heap Used:</span>
              <span class="font-mono">{performanceMetrics.memory.heapUsed.toFixed(2)} MB</span>
            </div>
            <div class="flex justify-between">
              <span>Item Bank Size:</span>
              <span class="font-mono">{performanceMetrics.memory.itemBankSize.toFixed(2)} MB</span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
```

## Implementation Steps

### Phase 1: Foundation (Core Structure)

1. **Create route structure**
   - Create `/apps/example/src/routes/toolkit-preview/` directory
   - Create `+layout.svelte` with three-column layout
   - Create `+page.svelte` landing page with element type grid
   - Create dynamic route `/[elementType]/+page.svelte`

2. **Build component scaffolding**
   - Create `ProfileEditor.svelte` (basic structure)
   - Create `DebugPanel.svelte` (basic structure)
   - Create `PlayerContainer.svelte` wrapper

3. **Set up data flow**
   - Create profile store (Svelte writable)
   - Create event log store
   - Create element type mapping

### Phase 2: Profile Editor (Editable Profiles)

4. **Implement profile templates**
   - Define 10 preset profiles
   - Create template selector dropdown
   - Implement load/reset functionality

5. **Build visual editor**
   - Student accommodations section (IEP/504)
   - Tools section with toggles
   - Assessment defaults section
   - District policies section

6. **Add JSON editor mode**
   - Syntax-highlighted JSON editor
   - Validation and error handling
   - Copy/paste functionality
   - LocalStorage persistence

### Phase 3: Assessment Player Integration

7. **Configure player instances**
   - Create single-item assessments for each element type
   - Map PIE examples to element type routes
   - Configure reference layout

8. **Connect profile to player**
   - Pass profile as prop
   - Handle profile updates
   - Test profile resolution

9. **Add event handling**
   - Listen to player events
   - Log to debug panel
   - Track performance metrics

### Phase 4: Debug Panel (Dev Tools)

10. **Event log tab**
    - Display live event stream
    - Filter and search
    - Export functionality

11. **Profile resolution tab**
    - Trace resolution steps
    - Show conflicts
    - Display final profile

12. **Accessibility audit tab**
    - Integrate WCAG checks
    - Keyboard navigation audit
    - Screen reader support check

13. **Performance metrics tab**
    - Rendering timings
    - Interaction timings
    - Memory usage

### Phase 5: Navigation & Polish

14. **Landing page**
    - Element type cards
    - Search/filter
    - Quick actions

15. **Keyboard shortcuts**
    - Toggle panels (Ctrl+E, Ctrl+D)
    - Navigation between types
    - Reset/copy shortcuts

16. **Add to main navigation**
    - Update app layout
    - Add nav link
    - Update home page

17. **Documentation**
    - Add tooltips/help text
    - Create user guide
    - Document keyboard shortcuts

## Testing Requirements

### Manual Testing

1. **Profile Resolution:**
   - Test each preset profile
   - Test profile conflicts (IEP overrides)
   - Test custom profiles

2. **Element Types:**
   - Verify each element type renders correctly
   - Test with different profiles
   - Test responsive behavior

3. **Accessibility:**
   - Keyboard navigation through all controls
   - Screen reader compatibility
   - WCAG AA compliance

4. **Performance:**
   - Profile change latency < 100ms
   - Smooth scrolling in debug panel
   - No memory leaks with repeated profile changes

### Automated Testing

1. **Unit Tests:**
   - Profile resolution logic
   - Event log filtering
   - Template loading

2. **Integration Tests:**
   - Profile → Player updates
   - Event logging
   - JSON import/export

3. **E2E Tests:**
   - Navigate to element types
   - Change profiles
   - Use keyboard shortcuts

## Success Metrics

1. **Developer Usage:**
   - Used for debugging toolkit issues
   - Used for event inspection
   - Used for performance profiling

2. **UX Professional Usage:**
   - Used for layout testing
   - Used for interaction testing
   - Used for responsive testing

3. **A11y Professional Usage:**
   - Used for accommodation testing
   - Used for WCAG compliance
   - Used for screen reader testing

## Future Enhancements

1. **Multi-item assessments:**
   - Add navigation between items
   - Test section-based assessments
   - Test linear vs. nonlinear navigation

2. **Item variants:**
   - Multiple examples per element type
   - A/B comparison view
   - Variant selector

3. **Profile sharing:**
   - Export profile to URL
   - Share via link
   - Import from URL

4. **Recording/Playback:**
   - Record user interactions
   - Replay sessions
   - Export session data

5. **Collaboration:**
   - Multi-user testing
   - Shared profiles
   - Real-time updates

## File Structure Summary

```
/apps/example/src/routes/toolkit-preview/
├── +layout.svelte                 # Three-column layout
├── +page.svelte                   # Landing page (element grid)
├── ProfileEditor.svelte           # Left sidebar
├── DebugPanel.svelte              # Right sidebar
├── PlayerContainer.svelte         # Center player wrapper
├── types.ts                       # TypeScript interfaces
├── profile-templates.ts           # Preset profiles
├── element-type-mapping.ts        # PIE element → route mapping
└── /[elementType]/
    └── +page.svelte               # Element type preview page
```

## Dependencies

**Required Packages (already available):**
- `@pie-players/pie-assessment-toolkit` - Core toolkit
- `@pie-players/pie-assessment-player` - Custom element wrapper
- DaisyUI - UI components
- Svelte - Framework

**Optional Enhancements:**
- `axe-core` - Accessibility auditing
- `monaco-editor` - Better JSON editing
- `chart.js` - Performance graphs

## Estimated Complexity

- **Phase 1:** Low (structure/scaffolding)
- **Phase 2:** Medium (profile editor with visual + JSON modes)
- **Phase 3:** Low (player integration straightforward)
- **Phase 4:** Medium-High (debug panel features)
- **Phase 5:** Low (navigation/polish)

**Total estimated effort:** Medium-Large feature

This builds on existing patterns from the example app, reuses components from the toolkit, and follows established conventions. The modular structure allows incremental implementation and testing.
