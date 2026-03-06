<script lang="ts">
  import { onMount } from 'svelte';
  
  let measurements: Array<{
    index: number;
    toolbar: { width: number; height: number; top: number; left: number };
    pane: { tag: string; classes: string; width: number; height: number } | null;
    isVisible: boolean;
  }> = [];
  
  let error = '';
  
  onMount(() => {
    setTimeout(() => {
      try {
        const targetWindow = window.open(
          'http://localhost:5301/demo/tts-ssml?mode=candidate&layout=splitpane',
          '_blank'
        );
        
        if (!targetWindow) {
          error = 'Could not open target window - popup may be blocked';
          return;
        }
        
        // Wait for the target page to load
        setTimeout(() => {
          try {
            const toolbars = targetWindow.document.querySelectorAll('pie-section-toolbar');
            
            if (toolbars.length === 0) {
              error = `No pie-section-toolbar elements found. Found ${targetWindow.document.querySelectorAll('*').length} total elements.`;
              targetWindow.close();
              return;
            }
            
            toolbars.forEach((toolbar, index) => {
              const rect = toolbar.getBoundingClientRect();
              let paneContainer = toolbar.closest('[class*="pane"], [class*="panel"], [class*="split"]');
              if (!paneContainer) {
                paneContainer = toolbar.parentElement;
              }
              
              const paneRect = paneContainer ? paneContainer.getBoundingClientRect() : null;
              const paneTag = paneContainer?.tagName;
              const paneClasses = paneContainer?.className;
              
              measurements.push({
                index: index + 1,
                toolbar: {
                  width: rect.width,
                  height: rect.height,
                  top: rect.top,
                  left: rect.left
                },
                pane: paneRect && paneTag && paneClasses
                  ? {
                      tag: paneTag,
                      classes: paneClasses,
                      width: paneRect.width,
                      height: paneRect.height
                    }
                  : null,
                isVisible: rect.width > 100 && rect.height > 30
              });
            });
            
            measurements = measurements; // Trigger reactivity
            targetWindow.close();
          } catch (err) {
            error = `Error measuring: ${err}`;
            targetWindow?.close();
          }
        }, 3000);
      } catch (err) {
        error = `Error: ${err}`;
      }
    }, 500);
  });
</script>

<div class="p-8">
  <h1 class="text-3xl font-bold mb-4">Toolbar Measurements</h1>
  
  {#if error}
    <div class="alert alert-error mb-4">
      <p>{error}</p>
    </div>
  {/if}
  
  {#if measurements.length === 0 && !error}
    <p>Measuring toolbars... (opening page in new window)</p>
  {/if}
  
  {#each measurements as m}
    <div class="card bg-base-200 mb-4 p-4">
      <h2 class="text-2xl font-bold mb-2">Toolbar {m.index}</h2>
      
      <div class="mb-3">
        <h3 class="text-lg font-semibold">pie-section-toolbar dimensions:</h3>
        <ul class="list-disc ml-6">
          <li>Width: {m.toolbar.width}px</li>
          <li>Height: {m.toolbar.height}px</li>
          <li>Top: {m.toolbar.top}px</li>
          <li>Left: {m.toolbar.left}px</li>
        </ul>
      </div>
      
      {#if m.pane}
        <div class="mb-3">
          <h3 class="text-lg font-semibold">Parent pane dimensions:</h3>
          <ul class="list-disc ml-6">
            <li>Tag: {m.pane.tag}</li>
            <li>Classes: {m.pane.classes}</li>
            <li>Width: {m.pane.width}px</li>
            <li>Height: {m.pane.height}px</li>
          </ul>
        </div>
      {/if}
      
      <div class:text-success={m.isVisible} class:text-error={!m.isVisible} class="font-bold">
        {#if m.isVisible}
          ✓ Toolbar is VISUALLY OBVIOUS (not a thin sliver)
        {:else}
          ✗ WARNING: Toolbar may be too small (thin sliver)
        {/if}
      </div>
    </div>
  {/each}
</div>
