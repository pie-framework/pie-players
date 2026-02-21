<script lang="ts">
  import { onMount } from "svelte";

  let {
    canonicalSessionSnapshot = null,
    onClose,
  }: {
    canonicalSessionSnapshot?: any;
    onClose: () => void;
  } = $props();

  let isMinimized = $state(false);
  let windowX = $state(0);
  let windowY = $state(100);
  let windowWidth = $state(400);
  let windowHeight = $state(600);
  let isDragging = $state(false);
  let isResizing = $state(false);

  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartWindowX = 0;
  let dragStartWindowY = 0;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;

  onMount(() => {
    windowX = window.innerWidth - 450;
  });

  function startDrag(e: MouseEvent) {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartWindowX = windowX;
    dragStartWindowY = windowY;

    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  }

  function onDrag(e: MouseEvent) {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    windowX = dragStartWindowX + deltaX;
    windowY = dragStartWindowY + deltaY;

    windowX = Math.max(0, Math.min(windowX, window.innerWidth - windowWidth));
    windowY = Math.max(0, Math.min(windowY, window.innerHeight - 100));
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
  }

  function startResize(e: MouseEvent) {
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartWidth = windowWidth;
    resizeStartHeight = windowHeight;

    document.addEventListener("mousemove", onResize);
    document.addEventListener("mouseup", stopResize);
    e.stopPropagation();
  }

  function onResize(e: MouseEvent) {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStartX;
    const deltaY = e.clientY - resizeStartY;

    windowWidth = Math.max(
      300,
      Math.min(resizeStartWidth + deltaX, window.innerWidth - windowX),
    );
    windowHeight = Math.max(
      200,
      Math.min(resizeStartHeight + deltaY, window.innerHeight - windowY),
    );
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener("mousemove", onResize);
    document.removeEventListener("mouseup", stopResize);
  }
</script>

<div
  class="fixed z-100 bg-base-100 rounded-lg shadow-2xl border-2 border-base-300"
  style="left: {windowX}px; top: {windowY}px; width: {windowWidth}px; {isMinimized
    ? 'height: auto;'
    : `height: ${windowHeight}px;`}"
>
  <div
    class="flex items-center justify-between px-4 py-2 bg-base-200 rounded-t-lg cursor-move select-none border-b border-base-300"
    onmousedown={startDrag}
    role="button"
    tabindex="0"
    aria-label="Drag session panel"
  >
    <div class="flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 class="font-bold text-sm">Session Data</h3>
    </div>
    <div class="flex gap-1">
      <button
        class="btn btn-xs btn-ghost btn-circle"
        onclick={() => (isMinimized = !isMinimized)}
        title={isMinimized ? "Maximize" : "Minimize"}
      >
        {#if isMinimized}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 15l7-7 7 7"
            />
          </svg>
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        {/if}
      </button>
      <button class="btn btn-xs btn-ghost btn-circle" onclick={onClose} title="Close">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>

  {#if !isMinimized}
    <div class="p-4 overflow-y-auto" style="max-height: {windowHeight - 60}px;">
      <div class="space-y-3">
        <div class="mb-2">
          <div class="text-sm font-bold mb-2">Combined Session View</div>
          <pre
            class="bg-base-300 p-2 rounded text-xs overflow-auto max-h-64">{JSON.stringify(
              canonicalSessionSnapshot,
              null,
              2,
            )}</pre>
        </div>
      </div>
    </div>
  {/if}

  {#if !isMinimized}
    <div
      class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
      onmousedown={startResize}
      role="button"
      tabindex="0"
      title="Resize window"
    >
      <svg
        class="w-full h-full text-base-content/30"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M16 16V14H14V16H16Z" />
        <path d="M16 11V9H14V11H16Z" />
        <path d="M13 16V14H11V16H13Z" />
      </svg>
    </div>
  {/if}
</div>
