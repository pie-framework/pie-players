<script lang="ts">
	import type { AssessmentSection, QuestionEntity } from '@pie-framework/pie-players-shared';

	let {
		sections = [] as AssessmentSection[],
		questions = [] as QuestionEntity[],
		currentSectionId = null,
		currentQuestionId = null,

		// Section operations
		onSectionAdd,
		onSectionRemove,
		onSectionUpdate,
		onSectionMove,

		// Question operations
		onQuestionMoveToSection,
		onQuestionRemoveFromSection,

		// Selection
		onSectionSelected,
		onQuestionSelected,

		readOnly = false
	}: {
		sections?: AssessmentSection[];
		questions?: QuestionEntity[];
		currentSectionId?: string | null;
		currentQuestionId?: string | null;

		onSectionAdd?: () => void;
		onSectionRemove?: (sectionId: string) => void;
		onSectionUpdate?: (sectionId: string, updates: Partial<AssessmentSection>) => void;
		onSectionMove?: (fromIndex: number, toIndex: number) => void;

		onQuestionMoveToSection?: (questionId: string, sectionId: string, index: number) => void;
		onQuestionRemoveFromSection?: (questionId: string, sectionId: string) => void;

		onSectionSelected?: (sectionId: string) => void;
		onQuestionSelected?: (questionId: string) => void;

		readOnly?: boolean;
	} = $props();

	// Drag state
	let draggedSectionIndex = $state<number | null>(null);
	let draggedQuestionId = $state<string | null>(null);
	let expandedSections = $state<Set<string>>(new Set());

	// Derived: Resolve questions for each section
	const questionsMap = $derived(new Map(questions.map((q) => [q.id, q])));

	function getSectionQuestions(section: AssessmentSection): QuestionEntity[] {
		return section.questions
			.map((ref) => questionsMap.get(ref.questionId))
			.filter((q): q is QuestionEntity => q !== undefined);
	}

	function getUnassignedQuestions(): QuestionEntity[] {
		const assignedIds = new Set(sections.flatMap((s) => s.questions.map((ref) => ref.questionId)));
		return questions.filter((q) => !assignedIds.has(q.id!));
	}

	function toggleSection(sectionId: string) {
		const newExpanded = new Set(expandedSections);
		if (newExpanded.has(sectionId)) {
			newExpanded.delete(sectionId);
		} else {
			newExpanded.add(sectionId);
		}
		expandedSections = newExpanded;
	}

	function handleSectionTitleChange(sectionId: string, title: string) {
		onSectionUpdate?.(sectionId, { title });
	}

	// Section drag handlers
	function handleSectionDragStart(event: DragEvent, index: number) {
		if (readOnly) return;
		draggedSectionIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', `section-${index}`);
		}
	}

	function handleSectionDrop(event: DragEvent, targetIndex: number) {
		if (readOnly || draggedSectionIndex === null) return;
		event.preventDefault();

		if (draggedSectionIndex !== targetIndex) {
			onSectionMove?.(draggedSectionIndex, targetIndex);
		}
		draggedSectionIndex = null;
	}

	// Question drag handlers
	function handleQuestionDragStart(event: DragEvent, questionId: string, _fromSectionId: string | null) {
		if (readOnly) return;
		draggedQuestionId = questionId;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', questionId);
		}
	}

	function handleQuestionDrop(event: DragEvent, toSectionId: string, targetIndex: number) {
		if (readOnly || draggedQuestionId === null) return;
		event.preventDefault();

		onQuestionMoveToSection?.(draggedQuestionId, toSectionId, targetIndex);
		draggedQuestionId = null;
	}

	function handleDragOver(event: DragEvent) {
		if (readOnly) return;
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDragEnd() {
		draggedSectionIndex = null;
		draggedQuestionId = null;
	}
</script>

<div class="assessment-section-list flex flex-col h-full bg-base-100">
	<!-- Header with Add Section button -->
	<div class="p-4 border-b border-base-300 flex items-center justify-between">
		<h3 class="font-bold text-lg">Assessment Structure</h3>
		{#if !readOnly && onSectionAdd}
			<button class="btn btn-primary btn-sm" onclick={onSectionAdd}>+ Add Section</button>
		{/if}
	</div>

	<!-- Scrollable section list -->
	<div class="flex-1 overflow-y-auto p-2">
		{#each sections as section, sectionIndex (section.id)}
			<div
				role="region"
				aria-label="Section: {section.title || 'Untitled Section'}"
				class="section-container mb-3 rounded-lg border transition-all"
				class:border-primary={section.id === currentSectionId}
				class:border-base-300={section.id !== currentSectionId}
				draggable={!readOnly}
				ondragstart={(e) => handleSectionDragStart(e, sectionIndex)}
				ondragover={handleDragOver}
				ondrop={(e) => handleSectionDrop(e, sectionIndex)}
				ondragend={handleDragEnd}
			>
				<!-- Section Header -->
				<div class="section-header p-3 bg-base-200 rounded-t-lg flex items-center justify-between">
					<div class="flex items-center gap-2 flex-1">
						{#if !readOnly}
							<span class="cursor-grab text-sm opacity-50">⋮⋮</span>
						{/if}

						<button class="btn btn-ghost btn-xs" onclick={() => toggleSection(section.id!)}>
							{expandedSections.has(section.id!) ? '▼' : '▶'}
						</button>

						<input
							type="text"
							class="input input-ghost input-sm flex-1 font-semibold"
							value={section.title || 'Untitled Section'}
							onchange={(e) => handleSectionTitleChange(section.id!, e.currentTarget.value)}
							readonly={readOnly}
							onclick={(e) => {
								e.stopPropagation();
								onSectionSelected?.(section.id!);
							}}
						/>

						<span class="badge badge-sm">{section.questions.length} items</span>
					</div>

					{#if !readOnly && onSectionRemove}
						<button
							class="btn btn-ghost btn-xs"
							onclick={(e) => {
								e.stopPropagation();
								onSectionRemove(section.id!);
							}}
							title="Remove section"
						>
							✕
						</button>
					{/if}
				</div>

				<!-- Section Questions (Collapsible) -->
				{#if expandedSections.has(section.id!)}
					<div class="section-questions p-2 bg-base-100">
						{#each getSectionQuestions(section) as question, qIndex (question.id)}
							<div
								role="button"
								tabindex="0"
								class="question-card cursor-pointer rounded p-2 mb-2 border transition-all group"
								class:border-primary={question.id === currentQuestionId}
								class:bg-primary={question.id === currentQuestionId}
								class:bg-opacity-5={question.id === currentQuestionId}
								class:border-base-300={question.id !== currentQuestionId}
								class:hover:bg-base-200={question.id !== currentQuestionId}
								draggable={!readOnly}
								ondragstart={(e) => handleQuestionDragStart(e, question.id!, section.id!)}
								ondragover={handleDragOver}
								ondrop={(e) => handleQuestionDrop(e, section.id!, qIndex)}
								ondragend={handleDragEnd}
								onclick={() => onQuestionSelected?.(question.id!)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onQuestionSelected?.(question.id!);
									}
								}}
							>
								<div class="flex items-center gap-2">
									{#if !readOnly}
										<span class="text-xs opacity-30">⋮⋮</span>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">{question.title || 'Untitled'}</div>
										<div class="text-xs opacity-60 font-mono truncate">{question.itemVId}</div>
									</div>
									{#if !readOnly && onQuestionRemoveFromSection}
										<button
											class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100"
											onclick={(e) => {
												e.stopPropagation();
												onQuestionRemoveFromSection(question.id!, section.id!);
											}}
											title="Remove from section"
										>
											✕
										</button>
									{/if}
								</div>
							</div>
						{/each}

						<!-- Drop zone for adding items -->
						{#if !readOnly}
							<div
								role="region"
								aria-label="Drop zone for adding items to section"
								class="drop-zone p-3 border-2 border-dashed border-base-300 rounded text-center text-xs opacity-50 hover:opacity-100 transition-opacity"
								ondragover={handleDragOver}
								ondrop={(e) => handleQuestionDrop(e, section.id!, getSectionQuestions(section).length)}
							>
								Drop items here
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}

		<!-- Unassigned Questions Section -->
		{#if getUnassignedQuestions().length > 0}
			<div class="unassigned-section mb-3 rounded-lg border border-dashed border-base-300">
				<div class="p-3 bg-base-200 rounded-t-lg">
					<h4 class="font-semibold text-sm opacity-70">Unassigned Items</h4>
					<p class="text-xs opacity-50">Drag these items into sections</p>
				</div>
				<div class="p-2">
					{#each getUnassignedQuestions() as question (question.id)}
						<div
							role="button"
							tabindex="0"
							aria-label="Unassigned question: {question.title || 'Untitled'}"
							class="question-card cursor-move rounded p-2 mb-2 border border-base-300 hover:bg-base-200"
							draggable={!readOnly}
							ondragstart={(e) => handleQuestionDragStart(e, question.id!, null)}
							ondragend={handleDragEnd}
						>
							<div class="flex items-center gap-2">
								<span class="text-xs opacity-30">⋮⋮</span>
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm truncate">{question.title || 'Untitled'}</div>
									<div class="text-xs opacity-60 font-mono truncate">{question.itemVId}</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.question-card {
		user-select: none;
	}

	.question-card:active {
		cursor: grabbing;
	}

	.section-container:active {
		cursor: grabbing;
	}
</style>
