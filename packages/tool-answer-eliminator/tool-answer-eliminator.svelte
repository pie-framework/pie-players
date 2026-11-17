<svelte:options
	customElement={{
		tag: 'pie-tool-answer-eliminator',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			strategy: { type: 'String', attribute: 'strategy' },
			alwaysOn: { type: 'Boolean', attribute: 'always-on' },

			// Store key per PIE element, by model id (JS property only)
			elementStateKeys: { type: 'Object', reflect: false },
			// Model ids of the elements whose choices take a toggle (JS property only)
			elementIds: { type: 'Array', reflect: false }
		},
		extend: coerceBooleanAttributes,
	}}
/>

<!--
@component
Process-of-elimination tool for the item in its enclosing `<pie-item-scope>`: it
adds a toggle to each choice an element supplies for `answer-masking` that
strikes the choice through, crosses it out or masks it, per `strategy`. The
toggle renders as the NDS icon button when the runtime context sets `ndsIcons`. It renders nothing of
its own and is active while `visible` or `always-on` is set; `elementIds` limits
the toggles to those elements' choices. Eliminations
persist in the runtime context's element tool state store, under the key
`elementStateKeys` gives each PIE element.
-->

<!-- Answer Eliminator Tool - Process-of-Elimination Support (Inline Toggle Mode)

  Allows students to mark answer choices as "eliminated" during test-taking,
  supporting the process-of-elimination strategy.

  **Interaction Pattern (Industry Standard):**
  - Student toggles tool ON via toolbar button
  - A small toggle (×) appears in each answer choice
  - Student clicks X buttons to eliminate/restore choices
  - Tool can be toggled OFF to hide all elimination buttons
  - OR can be "always-on" via student profile (alwaysOn prop)

  **Features:**
  - CSS Custom Highlight API, so struck text keeps its DOM nodes
  - Elements supply their choices through `pieSupportTargets('answer-masking')`
  - Strikethrough visual (WCAG 2.2 AA compliant, best for accessibility)
  - Eliminations persist across question navigation through the toolkit's element tool state store
  - Keyboard accessible with proper ARIA attributes

  **WCAG 2.2 Level AA Compliant:**
  - 1.3.1 Info and Relationships (maintains structure)
  - 2.4.3 Focus Order (no layout shift)
  - 3.3.1 Error Identification (easy to identify/correct)
  - 4.1.2 Name, Role, Value (proper ARIA)
-->

<script lang="ts">
	import type {
		AnswerEliminatorProps,
		ElementStateKeys,
	} from "./element-props.js";
	import { coerceBooleanAttributes } from '@pie-players/pie-players-shared/ui/attribute-coercion';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';
	import { ensureFontAwesome } from '@pie-players/pie-players-shared/ui/fontawesome';

	import {
		connectToolRuntimeContext,
		connectToolShellContext,
	} from '@pie-players/pie-assessment-toolkit/tools/registration';
	import type {
		AssessmentToolkitShellContext,
		AssessmentToolkitRuntimeContext,
	} from '@pie-players/pie-assessment-toolkit/tools/registration';
	import { untrack } from 'svelte';
	import {
		AnswerEliminatorCore,
	} from './answer-eliminator-core.js';

	let {
		visible = false,
		strategy = 'strikethrough' as 'strikethrough' | 'cross' | 'mask',
		alwaysOn = false, // Set true for profile-based accommodation
		elementStateKeys = {} as ElementStateKeys, // Store key per PIE element, by model id
		elementIds = undefined as readonly string[] | undefined // Elements whose choices take a toggle; unset for all
	}: AnswerEliminatorProps = $props();

	let contextHostElement = $state<HTMLElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let shellContext = $state<AssessmentToolkitShellContext | null>(null);
	// Where eliminations persist across question navigation.
	const elementToolStateStore = $derived(runtimeContext?.elementToolStateStore ?? null);
	let core = $state<AnswerEliminatorCore | null>(null);
	const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));
	let lastShellContextVersion = $state<number | null>(null);
	// The toggles render as <pie-nds-icon-button> only when the host opts in
	// (`ndsIcons === true`), and only once the tag is registered: created
	// before, the element would take its attributes literally. The bundle loads
	// the first time it is wanted, so a page that never sets `ndsIcons` neither
	// loads it nor takes its tag. players-shared is external to this package's
	// build, so the import stays a bare specifier in the published artifact.
	const useNdsIcons = $derived(runtimeContext?.ndsIcons === true);
	let ndsIconButtonReady = $state(
		typeof customElements !== 'undefined' && !!customElements.get('pie-nds-icon-button')
	);
	$effect(() => {
		if (!useNdsIcons || ndsIconButtonReady) return;
		import('@pie-players/pie-players-shared/nds-icon-button').then(
			() => {
				ndsIconButtonReady = true;
			},
			(error) => {
				console.warn('[AnswerEliminator] the NDS icon button failed to load; the toggles stay plain buttons', error);
			}
		);
	});
	// Every NDS glyph is FA Solid, which FA Free carries.
	$effect(() => {
		if (useNdsIcons) ensureFontAwesome(runtimeContext?.itemPlayer?.loaderOptions);
	});

	// Determine if tool should be active (either toggled on OR always-on mode)
	let isActive = $derived(alwaysOn || visible);

	$effect(() => {
		if (!contextHostElement) return;
		return connectToolRuntimeContext(contextHostElement, (value: AssessmentToolkitRuntimeContext) => {
			runtimeContext = value;
		});
	});

	$effect(() => {
		if (!contextHostElement) return;
		return connectToolShellContext(contextHostElement, (value: AssessmentToolkitShellContext) => {
			shellContext = value;
		});
	});

	function resolveQuestionRoot(): HTMLElement | null {
		return shellContext?.scopeElement || null;
	}

	function initializeForCurrentQuestion() {
		if (!isActive || !core) return;
		const questionRoot = resolveQuestionRoot();

		if (!questionRoot) {
			console.warn('[AnswerEliminator] Missing shell scope context for question root');
			return;
		}

		core.initializeForQuestion(questionRoot);
	}

	function handleItemChange() {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				initializeForCurrentQuestion();
			});
		});
	}

	// Relabel in place on a locale change: a rebuild would drop the eliminations
	// of choices whose element has no store key.
	$effect(() => {
		core?.setInterfaceI18n(interfaceI18n);
	});

	$effect(() => {
		core?.setNdsIcons(useNdsIcons && ndsIconButtonReady);
	});

	// Update store integration when the store or the element keys change
	$effect(() => {
		core?.setStoreIntegration(elementToolStateStore, elementStateKeys ?? {});
	});

	// Re-scan the question when the elements whose choices take a toggle change.
	let appliedElementIds: string | null = null;
	$effect(() => {
		const ids = elementIds ? [...elementIds] : null;
		const signature = ids ? JSON.stringify(ids) : null;
		untrack(() => {
			if (!core) return;
			core.setElementIds(ids);
			if (signature === appliedElementIds) return;
			appliedElementIds = signature;
			initializeForCurrentQuestion();
		});
	});

	// One core for the component's life. The toolbar owns this tool's
	// coordinator entry and passes its visibility in `visible`, which the effect
	// below turns into initialization.
	$effect(() => {
		const next = untrack(() => {
			const created = new AnswerEliminatorCore(strategy);
			created.setStoreIntegration(elementToolStateStore, elementStateKeys ?? {});
			created.setElementIds(elementIds ? [...elementIds] : null);
			created.setInterfaceI18n(interfaceI18n);
			created.setNdsIcons(useNdsIcons && ndsIconButtonReady);
			return created;
		});
		core = next;
		return () => {
			next.destroy();
			if (core === next) core = null;
		};
	});

	// Repainted in place, whether or not the tool is on, so every elimination,
	// toggle and focus survives the change.
	$effect(() => {
		core?.setStrategy(strategy);
	});

	$effect(() => {
		const shellVersion = shellContext?.contextVersion ?? null;
		if (shellVersion === null) return;
		if (lastShellContextVersion === null) {
			lastShellContextVersion = shellVersion;
			return;
		}
		if (shellVersion === lastShellContextVersion) return;
		lastShellContextVersion = shellVersion;
		handleItemChange();
	});

	// Watch for visibility changes to show/hide elimination buttons
	$effect(() => {
		if (core) {
			if (isActive) {
				// Re-enable state restoration when tool is activated
				core.enableStateRestoration();
				initializeForCurrentQuestion();
			} else {
				// Struck choices keep their toggles; the others leave the layout.
				core.cleanup();
			}
		}
	});
</script>

<!-- No visible UI - tool operates entirely through injected buttons next to choices -->
<!-- The toolbar button visibility is managed by tool-toolbar.svelte -->
<div bind:this={contextHostElement} style="display: none;" aria-hidden="true"></div>
