import type {
	AssessmentAuthoringCallbacks,
	AssessmentEntity,
	AssessmentSection,
	QuestionEntity,
	SectionQuestionRef,
} from "@pie-players/pie-players-shared";
import { TypedEventBus } from "../core/TypedEventBus.js";

/**
 * Service for managing assessment structure in authoring mode.
 * Handles adding/removing/reordering items and sections.
 */
interface AssessmentAuthoringEvents {
	"assessment-updated": AssessmentEntity;
}

export class AssessmentAuthoringService {
	private assessment: AssessmentEntity;
	private eventBus: TypedEventBus<AssessmentAuthoringEvents>;
	private callbacks: AssessmentAuthoringCallbacks;

	constructor(
		assessment: AssessmentEntity,
		callbacks: AssessmentAuthoringCallbacks = {},
	) {
		this.assessment = { ...assessment };
		this.callbacks = callbacks;
		this.eventBus = new TypedEventBus();

		// Initialize structure if missing
		if (!this.assessment.questions) {
			this.assessment.questions = [];
		}
		if (!this.assessment.sections) {
			this.assessment.sections = [];
		}
	}

	/**
	 * Get the current assessment structure
	 */
	getAssessment(): AssessmentEntity {
		return { ...this.assessment };
	}

	/**
	 * Subscribe to assessment updates
	 */
	subscribe(listener: (assessment: AssessmentEntity) => void): () => void {
		const wrappedListener = (event: CustomEvent<AssessmentEntity>) => {
			listener(event.detail);
		};
		this.eventBus.on("assessment-updated", wrappedListener);
		return () => {
			this.eventBus.off("assessment-updated", wrappedListener);
		};
	}

	/**
	 * Add a question/item to the assessment
	 */
	addItem(item: QuestionEntity, index?: number): void {
		const questions = this.assessment.questions || [];
		const targetIndex = index !== undefined ? index : questions.length;

		questions.splice(targetIndex, 0, item);
		this.assessment.questions = questions;

		this.callbacks.onItemAdded?.(item, targetIndex);
		this.emitUpdate();
	}

	/**
	 * Remove an item from the assessment
	 */
	removeItem(itemId: string): void {
		const questions = this.assessment.questions || [];
		const index = questions.findIndex((q: QuestionEntity) => q.id === itemId);

		if (index === -1) {
			return;
		}

		questions.splice(index, 1);
		this.assessment.questions = questions;

		// Also remove from sections
		if (this.assessment.sections) {
			this.assessment.sections = this.assessment.sections.map((section: AssessmentSection) => ({
				...section,
				questions: section.questions.filter((ref: SectionQuestionRef) => ref.questionId !== itemId),
			}));
		}

		this.callbacks.onItemRemoved?.(itemId, index);
		this.emitUpdate();
	}

	/**
	 * Move an item from one position to another
	 */
	moveItem(fromIndex: number, toIndex: number): void {
		const questions = this.assessment.questions || [];

		if (
			fromIndex < 0 ||
			fromIndex >= questions.length ||
			toIndex < 0 ||
			toIndex >= questions.length
		) {
			return;
		}

		const [item] = questions.splice(fromIndex, 1);
		questions.splice(toIndex, 0, item);
		this.assessment.questions = questions;

		this.callbacks.onItemMoved?.(fromIndex, toIndex);
		this.emitUpdate();
	}

	/**
	 * Update an item's properties
	 */
	updateItem(itemId: string, updates: Partial<QuestionEntity>): void {
		const questions = this.assessment.questions || [];
		const index = questions.findIndex((q: QuestionEntity) => q.id === itemId);

		if (index === -1) {
			return;
		}

		questions[index] = { ...questions[index], ...updates };
		this.assessment.questions = questions;

		this.callbacks.onItemUpdated?.(itemId, updates);
		this.emitUpdate();
	}

	/**
	 * Reorder items to match the provided question IDs
	 */
	reorderItems(newOrder: string[]): void {
		const questions = this.assessment.questions || [];
		const questionMap = new Map(questions.map((q: QuestionEntity) => [q.id, q]));

		const reordered = newOrder
			.map((id) => questionMap.get(id))
			.filter((q): q is QuestionEntity => q !== undefined);

		this.assessment.questions = reordered;
		this.emitUpdate();
	}

	/**
	 * Add a section to the assessment
	 */
	addSection(section: AssessmentSection, index?: number): void {
		const sections = this.assessment.sections || [];
		const targetIndex = index !== undefined ? index : sections.length;

		sections.splice(targetIndex, 0, section);
		this.assessment.sections = sections;

		this.callbacks.onSectionAdded?.(section, targetIndex);
		this.emitUpdate();
	}

	/**
	 * Remove a section from the assessment
	 */
	removeSection(sectionId: string): void {
		const sections = this.assessment.sections || [];
		const index = sections.findIndex((s: AssessmentSection) => s.id === sectionId);

		if (index === -1) {
			return;
		}

		sections.splice(index, 1);
		this.assessment.sections = sections;

		this.callbacks.onSectionRemoved?.(sectionId, index);
		this.emitUpdate();
	}

	/**
	 * Update a section's properties
	 */
	updateSection(sectionId: string, updates: Partial<AssessmentSection>): void {
		const sections = this.assessment.sections || [];
		const index = sections.findIndex((s: AssessmentSection) => s.id === sectionId);

		if (index === -1) {
			return;
		}

		sections[index] = { ...sections[index], ...updates };
		this.assessment.sections = sections;

		this.callbacks.onSectionUpdated?.(sectionId, updates);
		this.emitUpdate();
	}

	/**
	 * Add a question to a section
	 */
	addQuestionToSection(
		sectionId: string,
		questionId: string,
		sort?: string,
	): void {
		const sections = this.assessment.sections || [];
		const section = sections.find((s: AssessmentSection) => s.id === sectionId);

		if (!section) {
			return;
		}

		const ref: SectionQuestionRef = { questionId, sort };
		section.questions = [...(section.questions || []), ref];

		this.emitUpdate();
	}

	/**
	 * Remove a question from a section
	 */
	removeQuestionFromSection(sectionId: string, questionId: string): void {
		const sections = this.assessment.sections || [];
		const section = sections.find((s: AssessmentSection) => s.id === sectionId);

		if (!section) {
			return;
		}

		section.questions = section.questions.filter(
			(ref: SectionQuestionRef) => ref.questionId !== questionId,
		);

		this.emitUpdate();
	}

	/**
	 * Emit assessment update event
	 */
	private emitUpdate(): void {
		this.callbacks.onAssessmentUpdated?.(this.assessment);
		this.eventBus.emit("assessment-updated", this.assessment);
	}
}
