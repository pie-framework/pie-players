<!-- Magnifier.svelte - Modern Svelte 5 implementation of HTML magnifier -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';

	interface MagnifierProps {
		zoom?: number;
		width?: number;
		height?: number;
		shape?: 'square' | 'circle';
		visible?: boolean;
		onPrepareContent?: (clonedContent: HTMLElement) => void;
		onContentUpdated?: (bodyElement: HTMLElement) => void;
	}

	let {
		zoom = 2,
		width = 420,
		height = 280,
		shape = 'square',
		visible = $bindable(false),
		onPrepareContent,
		onContentUpdated
	}: MagnifierProps = $props();

	// Reactive state
	let magnifierEl = $state<HTMLDivElement | null>(null);
	let contentEl = $state<HTMLDivElement | null>(null);
	let clonedBody = $state<HTMLElement | null>(null);
	let position = $state({ x: 200, y: 200 });
	let isDragging = $state(false);
	let dragOffset = $state({ x: 0, y: 0 });

	// MutationObserver to sync content changes
	let observer: MutationObserver | null = null;
	let syncTimeoutHandle: number | null = null;

	// Derived styles
	let magnifierStyle = $derived(`
		left: ${position.x}px;
		top: ${position.y}px;
		width: ${width}px;
		height: ${height}px;
		${shape === 'circle' ? 'border-radius: 50%;' : ''}
		display: ${visible ? 'block' : 'none'};
	`);

	let contentStyle = $derived(`
		transform: scale(${zoom});
		left: ${-position.x * zoom - window.scrollX * zoom}px;
		top: ${-position.y * zoom - window.scrollY * zoom}px;
		width: ${document.body.scrollWidth}px;
		height: ${document.body.scrollHeight}px;
	`);

	function cloneDocumentBody() {
		const bodyOriginal = document.body;
		const bodyCopy = bodyOriginal.cloneNode(true) as HTMLElement;

		// Copy background color
		const bgColor = getComputedStyle(bodyOriginal).backgroundColor;
		if (bgColor && magnifierEl) {
			magnifierEl.style.backgroundColor = bgColor;
		}

		// Reset styles
		bodyCopy.style.cursor = 'auto';
		bodyCopy.style.paddingTop = '0px';
		bodyCopy.setAttribute('unselectable', 'on');

		// Copy canvas contents
		const canvasOriginal = bodyOriginal.querySelectorAll('canvas');
		const canvasCopy = bodyCopy.querySelectorAll('canvas');
		if (canvasOriginal.length > 0 && canvasOriginal.length === canvasCopy.length) {
			for (let i = 0; i < canvasOriginal.length; i++) {
				const ctx = canvasCopy[i].getContext('2d');
				if (ctx) {
					try {
						ctx.drawImage(canvasOriginal[i], 0, 0);
					} catch (error) {
						// Silent fail - likely CORS issue
					}
				}
			}
		}

		// Remove elements that shouldn't be magnified
		const elementsToRemove = [
			...bodyCopy.querySelectorAll('script'),
			...bodyCopy.querySelectorAll('audio'),
			...bodyCopy.querySelectorAll('video'),
			...bodyCopy.querySelectorAll('.pie-tool-magnifier__viewport'),
			...bodyCopy.querySelectorAll('.pie-tool-magnifier__clone-ignore'),
			...bodyCopy.querySelectorAll('[data-magnifier-ignore]')
		];
		elementsToRemove.forEach(el => el.remove());

		// Custom content preparation
		if (onPrepareContent) {
			onPrepareContent(bodyCopy);
		}

		return bodyCopy;
	}

	function updateContent() {
		if (!visible || !contentEl) return;

		// Clear existing content
		contentEl.innerHTML = '';

		// Clone and prepare content
		clonedBody = cloneDocumentBody();
		contentEl.appendChild(clonedBody);

		// Sync scroll positions
		syncScrollPositions();

		// Notify content update
		if (onContentUpdated && clonedBody) {
			const bodyInClone = clonedBody.querySelector('body');
			if (bodyInClone) {
				onContentUpdated(bodyInClone as HTMLElement);
			}
		}
	}

	function syncScrollPositions() {
		if (!clonedBody) return;

		// Find all scrolled divs in the original document
		const scrolledDivs = Array.from(document.querySelectorAll('div')).filter(
			div => div.scrollTop > 0 && !magnifierEl?.contains(div)
		);

		// Sync scroll positions to cloned elements
		scrolledDivs.forEach(div => {
			const selectors: string[] = [];

			if (div.id) {
				selectors.push('#' + div.id);
			}
			if (div.className) {
				selectors.push('.' + div.className.split(' ').join('.'));
			}

			selectors.forEach(selector => {
				const targets = clonedBody!.querySelectorAll(selector);
				if (targets.length === 1) {
					const target = targets[0] as HTMLElement;
					target.scrollTop = div.scrollTop;
					target.scrollLeft = div.scrollLeft;
				}
			});
		});
	}

	function queueContentUpdate() {
		if (syncTimeoutHandle !== null) {
			clearTimeout(syncTimeoutHandle);
		}
		syncTimeoutHandle = window.setTimeout(() => {
			updateContent();
		}, 100);
	}

	function startObserving() {
		if (observer) return;

		observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				// Skip mutations within the magnifier itself
				if (magnifierEl && magnifierEl.contains(mutation.target as Node)) {
					continue;
				}
				queueContentUpdate();
				break;
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class', 'width', 'height', 'style'],
			attributeOldValue: true
		});
	}

	function stopObserving() {
		if (observer) {
			observer.disconnect();
			observer = null;
		}
		if (syncTimeoutHandle !== null) {
			clearTimeout(syncTimeoutHandle);
			syncTimeoutHandle = null;
		}
	}

	// Drag handlers
	function handlePointerDown(e: PointerEvent) {
		// Don't start drag on interactive elements or their children
		const target = e.target as HTMLElement;

		// Check if the target or any parent is an interactive element
		const interactiveTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'];
		let element: HTMLElement | null = target;
		while (element && element !== magnifierEl) {
			if (interactiveTags.includes(element.tagName.toUpperCase())) {
				return;
			}
			element = element.parentElement;
		}

		isDragging = true;
		dragOffset = {
			x: e.clientX - position.x,
			y: e.clientY - position.y
		};

		if (magnifierEl) {
			magnifierEl.setPointerCapture(e.pointerId);
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging) return;

		position = {
			x: e.clientX - dragOffset.x,
			y: e.clientY - dragOffset.y
		};
	}

	function handlePointerUp(e: PointerEvent) {
		if (isDragging && magnifierEl) {
			magnifierEl.releasePointerCapture(e.pointerId);
		}
		isDragging = false;
	}

	// Scroll sync handler
	function handleScroll(e: Event) {
		if (!visible) return;

		const target = e.target as HTMLElement;
		if (magnifierEl?.contains(target)) return;

		// Queue a content update to sync scroll positions
		queueContentUpdate();
	}

	// Update content when becoming visible
	$effect(() => {
		if (visible) {
			untrack(() => {
				updateContent();
				startObserving();
			});
		} else {
			untrack(() => {
				stopObserving();
			});
		}
	});

	// Update content when zoom changes
	$effect(() => {
		// Track zoom dependency
		zoom;
		if (visible) {
			untrack(() => {
				updateContent();
			});
		}
	});

	// Lifecycle
	onMount(() => {
		// Listen for scroll events
		window.addEventListener('scroll', handleScroll, true);
		window.addEventListener('resize', queueContentUpdate);

		return () => {
			stopObserving();
			window.removeEventListener('scroll', handleScroll, true);
			window.removeEventListener('resize', queueContentUpdate);
		};
	});
</script>

<div
	bind:this={magnifierEl}
	class="pie-tool-magnifier__viewport"
	style={magnifierStyle}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	role="region"
	aria-label="Content magnifier"
>
	<div bind:this={contentEl} class="pie-tool-magnifier__content" style={contentStyle}></div>
	<div class="pie-tool-magnifier__glass"></div>
	<slot />
</div>

<style>
	.pie-tool-magnifier__viewport {
		position: fixed;
		overflow: hidden;
		background-color: white;
		border: 1px solid #555;
		border-radius: 4px;
		z-index: 10000;
		cursor: move;
		touch-action: none;
	}

	.pie-tool-magnifier__content {
		position: absolute;
		top: 0;
		left: 0;
		overflow: visible;
		display: block;
		transform-origin: left top;
		user-select: none;
		pointer-events: none;
	}

	.pie-tool-magnifier__glass {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		background-color: transparent;
		pointer-events: all;
	}
</style>
