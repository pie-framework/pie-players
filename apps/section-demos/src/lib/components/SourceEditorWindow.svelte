<script lang="ts">
  import { onMount } from "svelte";

  let {
    isSourceValid,
    sourceParseError,
    editedSourceJson,
    onEditorElementChange,
    onFormatModelJson,
    onClose,
  }: {
    isSourceValid: boolean;
    sourceParseError: string | null;
    editedSourceJson: string;
    onEditorElementChange: (el: HTMLDivElement | null) => void;
    onFormatModelJson: () => void;
    onClose: () => void;
  } = $props();

  let editorElement: HTMLDivElement | null = $state(null);
  let isMinimized = $state(false);
  let windowX = $state(50);
  let windowY = $state(50);
  let windowWidth = $state(800);
  let windowHeight = $state(700);
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
    onEditorElementChange(editorElement);
  });

  $effect(() => {
    onEditorElementChange(editorElement);
  });

  function copyJson() {
    navigator.clipboard.writeText(editedSourceJson);
  }

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
      400,
      Math.min(resizeStartWidth + deltaX, window.innerWidth - windowX),
    );
    windowHeight = Math.max(
      300,
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
    aria-label="Drag source panel"
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
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
      <h3 class="font-bold text-sm">Source</h3>
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
    <div class="flex flex-col" style="height: {windowHeight - 50}px;">
      <div
        class="flex items-center justify-between px-4 py-2 bg-base-200/50 border-b border-base-300"
      >
        <div class="text-xs text-base-content/70">
          {isSourceValid ? "Valid JSON" : "Invalid JSON"}
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-xs btn-ghost"
            onclick={onFormatModelJson}
            title="Format model JSON"
            disabled={!isSourceValid}
          >
            Format
          </button>
          <button class="btn btn-xs btn-ghost" onclick={copyJson} title="Copy to clipboard">
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
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy
          </button>
        </div>
      </div>

      {#if sourceParseError}
        <div class="mx-4 mt-2">
          <div class="alert alert-error alert-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-xs">{sourceParseError}</span>
          </div>
        </div>
      {/if}

      <div class="flex-1 overflow-auto">
        <div
          bind:this={editorElement}
          class="border-none focus:outline-none bg-base-300 text-xs font-mono"
        ></div>
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
