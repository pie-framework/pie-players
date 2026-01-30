<script lang="ts">
  import * as math from 'mathjs';
  import Calculator from '../src/components/Calculator.svelte';

  let selectedType: 'basic' | 'scientific' = $state('scientific');
  let selectedTheme: 'light' | 'dark' | 'auto' = $state('light');
  let calcRef: any;

  function handleStateChange(state: any) {
    console.log('Calculator state changed:', state);
  }
</script>

<div class="min-h-screen bg-base-200 flex items-center justify-center p-8">
  <div class="max-w-4xl w-full">
    <!-- Simple header -->
    <div class="text-center mb-6">
      <h1 class="text-3xl font-bold mb-2">Calculator</h1>
    </div>

    <!-- Minimal controls -->
    <div class="flex justify-center gap-4 mb-6">
      <div class="join">
        <button
          class="join-item btn {selectedType === 'basic' ? 'btn-active' : ''}"
          onclick={() => selectedType = 'basic'}
        >
          Basic
        </button>
        <button
          class="join-item btn {selectedType === 'scientific' ? 'btn-active' : ''}"
          onclick={() => selectedType = 'scientific'}
        >
          Scientific
        </button>
      </div>

      <div class="join">
        <button
          class="join-item btn {selectedTheme === 'light' ? 'btn-active' : ''}"
          onclick={() => selectedTheme = 'light'}
        >
          Light
        </button>
        <button
          class="join-item btn {selectedTheme === 'dark' ? 'btn-active' : ''}"
          onclick={() => selectedTheme = 'dark'}
        >
          Dark
        </button>
      </div>
    </div>

    <!-- Calculator -->
    <div class="flex justify-center">
      <div data-theme={selectedTheme}>
        <Calculator
          bind:this={calcRef}
          type={selectedType}
          theme={selectedTheme}
          {math}
          onStateChange={handleStateChange}
        />
      </div>
    </div>
  </div>
</div>
