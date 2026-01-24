<script lang="ts">
	import { Editor } from '@tiptap/core';
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
	import Document from '@tiptap/extension-document';
	import History from '@tiptap/extension-history';
	import Text from '@tiptap/extension-text';
	import { all, createLowlight } from 'lowlight';
	import { onDestroy, onMount } from 'svelte';

	const lowlight = createLowlight(all);

	interface Props {
		content: string;
		onContentChange?: (content: string) => void;
		readOnly?: boolean;
		language?: string;
		minHeight?: string;
	}

	let { content = $bindable(''), onContentChange, readOnly = false, language = 'json', minHeight }: Props = $props();

	let editor: Editor | null = $state(null);
	let editorElement: HTMLDivElement | null = $state(null);
	let isUpdatingFromProp = false;

	function escapeHtml(text: string): string {
		const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
		return text.replace(/[&<>"']/g, (m) => map[m]);
	}

	function unescapeHtml(text: string): string {
		const map: Record<string, string> = {
			'&amp;': '&',
			'&lt;': '<',
			'&gt;': '>',
			'&quot;': '"',
			'&#039;': "'"
		};
		return text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;/g, (m) => map[m]);
	}

	function formatContentAsHtml(text: string): string {
		return `<pre><code data-language="${language}">${escapeHtml(text)}</code></pre>`;
	}

	function extractTextFromHtml(html: string): string {
		const codeBlockMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
		if (codeBlockMatch) return unescapeHtml(codeBlockMatch[1]);
		return '';
	}

	onMount(() => {
		if (!editorElement) return;
		const htmlContent = formatContentAsHtml(content);

		editor = new Editor({
			element: editorElement,
			extensions: [
				Document,
				CodeBlockLowlight.configure({
					lowlight,
					defaultLanguage: language
				}),
				Text,
				History
			],
			content: htmlContent,
			editable: !readOnly,
			editorProps: {
				attributes: {
					class: 'tiptap-editor'
				}
			},
			onUpdate: ({ editor }) => {
				if (isUpdatingFromProp) {
					isUpdatingFromProp = false;
					return;
				}
				const newContent = extractTextFromHtml(editor.getHTML());
				content = newContent;
				onContentChange?.(newContent);
			}
		});
	});

	$effect(() => {
		if (editor && !isUpdatingFromProp) {
			const currentContent = extractTextFromHtml(editor.getHTML());
			if (currentContent !== content) {
				isUpdatingFromProp = true;
				editor.commands.setContent(formatContentAsHtml(content));
			}
		}
	});

	$effect(() => {
		editor?.setEditable(!readOnly);
	});

	onDestroy(() => {
		editor?.destroy();
	});

	function formatJson() {
		if (readOnly) return;
		try {
			const parsed = JSON.parse(content);
			const formatted = JSON.stringify(parsed, null, 2);
			content = formatted;
			onContentChange?.(formatted);
			if (editor) {
				isUpdatingFromProp = true;
				editor.commands.setContent(formatContentAsHtml(formatted));
			}
		} catch {
			// ignore
		}
	}
</script>

<div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
	<div class="flex items-center gap-2 p-2 border-b border-base-300 bg-base-200">
		<div class="text-xs opacity-70">{language}</div>
		<div class="flex-1"></div>
		<button class="btn btn-xs btn-ghost" onclick={formatJson} disabled={readOnly || language !== 'json'}>
			Format
		</button>
	</div>
	<div class="p-3 max-h-[520px] overflow-auto" style:min-height={minHeight}>
		<div bind:this={editorElement} class="editor-content"></div>
	</div>
</div>

<style>
	.editor-content :global(.tiptap-editor) {
		outline: none;
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.85rem;
		line-height: 1.6;
	}

	.editor-content :global(pre) {
		margin: 0;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 0;
	}

	.editor-content :global(code) {
		display: block;
		white-space: pre;
	}
</style>


