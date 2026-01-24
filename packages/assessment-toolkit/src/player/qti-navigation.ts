import type {
	AssessmentEntity,
	QuestionEntity,
	QtiAssessmentSection,
} from "@pie-framework/pie-players-shared/types";

export interface QuestionRef {
	/**
	 * QTI identifier-like string. For non-QTI data, we fall back to question id or itemVId.
	 */
	identifier: string;
	itemVId: string;
}

export type NavigationNode = {
	type: "question" | "section" | "testPart";
	id: string;
	identifier: string;
	// Present for question nodes
	itemVId?: string;
	// Present for section/testPart nodes
	title?: string;
	children?: NavigationNode[];
};

function toQuestionRef(q: QuestionEntity, idx: number): QuestionRef {
	const identifier = q.id || q.itemVId || `q-${idx}`;
	return { identifier, itemVId: q.itemVId };
}

export type AssessmentFormat = "flat" | "qti";

export function detectAssessmentFormat(assessment: AssessmentEntity): AssessmentFormat {
	return assessment.testParts?.length ? "qti" : "flat";
}

/**
 * Minimal replacement for `@pie-api-aws/datastore` navigation helpers.
 * Produces a stable, linear question ref list from the assessment shape we ship in `pie-players-shared`.
 */
export function getAllQuestionRefs(
	assessment: AssessmentEntity,
): QuestionRef[] {
	const format = detectAssessmentFormat(assessment);
	if (format === "qti") {
		return extractFromQti(assessment);
	}
	return extractFromLegacy(assessment);
}

/**
 * Build a simple navigation tree.
 * If `assessment.sections` is present, we expose those as sections; otherwise it’s a flat list.
 */
export function buildNavigationStructure(
	assessment: AssessmentEntity,
): NavigationNode[] {
	const format = detectAssessmentFormat(assessment);
	if (format === "qti") {
		return buildNavigationFromQti(assessment);
	}
	return buildNavigationFromLegacy(assessment);
}

function extractFromLegacy(assessment: AssessmentEntity): QuestionRef[] {
	const questions = assessment.questions ?? [];
	const sections = assessment.sections;
	if (!sections?.length) {
		return questions.map(toQuestionRef);
	}

	const byId = new Map<string, QuestionEntity>();
	const byItemVId = new Map<string, QuestionEntity>();
	for (const q of questions) {
		if (q.id) byId.set(String(q.id), q);
		if (q.itemVId) byItemVId.set(String(q.itemVId), q);
	}

	const refs: QuestionRef[] = [];
	for (const section of sections) {
		for (const sq of section.questions ?? []) {
			const qid = String(sq.questionId ?? "");
			const q = byId.get(qid) || byItemVId.get(qid);
			if (!q) continue;
			refs.push({ identifier: q.id || q.itemVId, itemVId: q.itemVId });
		}
	}
	return refs;
}

function buildNavigationFromLegacy(assessment: AssessmentEntity): NavigationNode[] {
	const questions = assessment.questions ?? [];
	const sections = assessment.sections;

	if (sections?.length) {
		const questionById = new Map<string, QuestionEntity>();
		for (const q of questions) {
			if (q.id) questionById.set(String(q.id), q);
			if (q.itemVId) questionById.set(String(q.itemVId), q);
		}

		return sections.map((s, sectionIndex) => {
			const children: NavigationNode[] = (s.questions ?? [])
				.map((ref, idx) => {
					const q = questionById.get(ref.questionId);
					if (!q) return null;
					const qr = toQuestionRef(q, idx);
					return {
						type: "question",
						id: q.id || qr.identifier,
						identifier: qr.identifier,
						itemVId: qr.itemVId,
					} as NavigationNode;
				})
				.filter(Boolean) as NavigationNode[];

			return {
				type: "section",
				id: s.id || `section-${sectionIndex}`,
				identifier: s.id || `section-${sectionIndex}`,
				title: s.title,
				children,
			};
		});
	}

	return questions.map((q, idx) => {
		const qr = toQuestionRef(q, idx);
		return {
			type: "question",
			id: q.id || qr.identifier,
			identifier: qr.identifier,
			itemVId: qr.itemVId,
		} as NavigationNode;
	});
}

function buildNavigationFromQti(assessment: AssessmentEntity): NavigationNode[] {
	const testParts = assessment.testParts ?? [];
	return testParts.map((tp, idx) => {
		return {
			type: "testPart",
			id: tp.id || tp.identifier || `testPart-${idx + 1}`,
			identifier: tp.identifier || `testPart-${idx + 1}`,
			title: tp.identifier,
			children: (tp.sections ?? []).map(buildSectionNavigation),
		} satisfies NavigationNode;
	});
}

function buildSectionNavigation(section: QtiAssessmentSection): NavigationNode {
	const children: NavigationNode[] = [];

	// Item refs
	for (const [idx, ref] of (section.questionRefs ?? []).entries()) {
		children.push({
			type: "question",
			id: ref.id || ref.identifier || ref.itemVId,
			identifier: ref.identifier || ref.itemVId || `q-${idx + 1}`,
			title: ref.title,
			itemVId: ref.itemVId,
		});
	}

	// Nested sections
	for (const sub of section.sections ?? []) {
		children.push(buildSectionNavigation(sub));
	}

	return {
		type: "section",
		id: section.id || section.identifier,
		identifier: section.identifier,
		title: section.title,
		children,
	};
}

function extractFromQti(assessment: AssessmentEntity): QuestionRef[] {
	const refs: QuestionRef[] = [];
	for (const tp of assessment.testParts ?? []) {
		for (const section of tp.sections ?? []) {
			extractRefsFromSection(section, refs);
		}
	}
	return refs;
}

function extractRefsFromSection(section: QtiAssessmentSection, out: QuestionRef[]): void {
	for (const ref of section.questionRefs ?? []) {
		if (!ref?.itemVId) continue;
		out.push({ identifier: ref.identifier || ref.itemVId, itemVId: ref.itemVId });
	}
	for (const sub of section.sections ?? []) {
		extractRefsFromSection(sub, out);
	}
}
