<script lang="ts">
	
	import { Editor } from '@tiptap/core';
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
	import Document from '@tiptap/extension-document';
	import History from '@tiptap/extension-history';
	import Text from '@tiptap/extension-text';
	import { common, createLowlight } from 'lowlight';
import { onDestroy, onMount } from 'svelte';

	let {
		value,
		onInput
	}: {
		value: string;
		onInput?: (value: string) => void;
	} = $props();

	let editorElement: HTMLDivElement;
	let editor: Editor | null = null;
	const lowlight = createLowlight(common);

	function buildJsonDoc(text: string) {
		return {
			type: 'doc',
			content: [
				{
					type: 'codeBlock',
					attrs: {
						language: 'json'
					},
					content: text ? [{ type: 'text', text }] : []
				}
			]
		};
	}

	onMount(() => {
		editor = new Editor({
			element: editorElement,
			extensions: [
				Document,
				Text,
				History,
				CodeBlockLowlight.configure({
					lowlight,
					defaultLanguage: 'json'
				})
			],
			content: buildJsonDoc(value),
			editorProps: {
				attributes: {
					class: 'prose prose-sm max-w-none focus:outline-none min-h-96'
				}
			},
			onUpdate: ({ editor }) => {
				const text = editor.state.doc.textContent;
				onInput?.(text);
			}
		});
	});

	onDestroy(() => {
		editor?.destroy();
	});

	// Update editor when value changes externally
	$effect(() => {
		if (editor && value !== editor.state.doc.textContent) {
			editor.commands.setContent(buildJsonDoc(value));
		}
	});
</script>

<div bind:this={editorElement} class="border border-base-300 rounded p-2"></div>
