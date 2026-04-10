import type { DemoInfo } from "./types";

export type { DemoInfo } from "./types";

import categorizeAlgebraOperations from "./categorize-algebra-operations";
import categorizeCalculusConcepts from "./categorize-calculus-concepts";
import categorizeGeometryShapes from "./categorize-geometry-shapes";
import categorizeMathEquations from "./categorize-math-equations";
import chartingBarChartStatistics from "./charting-bar-chart-statistics";
import chartingHistogramFrequency from "./charting-histogram-frequency";
import chartingLineChartGrowth from "./charting-line-chart-growth";
import complexRubric1 from "./complex-rubric-1";
import dragInTheBlankBasicSentence from "./drag-in-the-blank-basic-sentence";
import dragInTheBlankChemistryDuplicates from "./drag-in-the-blank-chemistry-duplicates";
import dragInTheBlankMathEquations from "./drag-in-the-blank-math-equations";
import dragInTheBlankWordProblemsImages from "./drag-in-the-blank-word-problems-images";
import drawingResponseDefault from "./drawing-response-default";
import ebsrDefault from "./ebsr-default";
import explicitConstructedResponseDefault from "./explicit-constructed-response-default";
import extendedTextEntryDefault from "./extended-text-entry-default";
import fractionModelPieImproperFraction from "./fraction-model-pie-improper-fraction";
import fractionModelSimpleBarHalves from "./fraction-model-simple-bar-halves";
import fractionModelStudentConfigThirds from "./fraction-model-student-config-thirds";
import graphingLinearFunction from "./graphing-linear-function";
import graphingParabolaVertex from "./graphing-parabola-vertex";
import graphingSineWaveTrigonometry from "./graphing-sine-wave-trigonometry";
import graphingSolutionSetInequalityDashedLine from "./graphing-solution-set-inequality-dashed-line";
import graphingSolutionSetInequalitySolidLine from "./graphing-solution-set-inequality-solid-line";
import graphingSolutionSetSystemTwoInequalities from "./graphing-solution-set-system-two-inequalities";
import hotspotDefault from "./hotspot-default";
import imageClozeAssociationDefault from "./image-cloze-association-default";
import inlineDropdownDefault from "./inline-dropdown-default";
import likertDefault from "./likert-default";
import matchDefault from "./match-default";
import matchListDefault from "./match-list-default";
import mathInlineDefault from "./math-inline-default";
import mathTemplatedDefault from "./math-templated-default";
import matrixDefault from "./matrix-default";
import mcPopulatedBlankVariantSelR1Gplusggg from "./mc-populated-blank-variant-sel-r1-gplusggg";
import mcPopulatedBlankVariantSelR1GStem from "./mc-populated-blank-variant-sel-r1-g-stem";
import mcPopulatedBlankVariantSelR1GgPlus from "./mc-populated-blank-variant-sel-r1-gg-plus";
import mcPopulatedBlankVariantSelR1Ggplus from "./mc-populated-blank-variant-sel-r1-ggplus";
import mcPopulatedBlankVariantSelR1Plusggg from "./mc-populated-blank-variant-sel-r1-plusggg";
import mcPopulatedBlankVariantSelR1S3 from "./mc-populated-blank-variant-sel-r1-s3";
import mcPopulatedBlankVariantSelVic from "./mc-populated-blank-variant-sel-vic";
import mcPopulatedBlankVariantSrVic from "./mc-populated-blank-variant-sr-vic";
import multiTraitRubricDefault from "./multi-trait-rubric-default";
import multipleChoiceBasicCheckbox from "./multiple-choice-basic-checkbox";
import multipleChoiceMathAlgebraQuadratic from "./multiple-choice-math-algebra-quadratic";
import multipleChoiceMathGeometryTriangles from "./multiple-choice-math-geometry-triangles";
import multipleChoiceNoPrefix from "./multiple-choice-no-prefix";
import multipleChoiceNumbersPrefix from "./multiple-choice-numbers-prefix";
import multipleChoiceRadioSimple from "./multiple-choice-radio-simple";
import numberLineBasicPoints from "./number-line-basic-points";
import numberLineFractionsDecimals from "./number-line-fractions-decimals";
import numberLineInequalityRays from "./number-line-inequality-rays";
import numberLineIntervalsRanges from "./number-line-intervals-ranges";
import passageDefault from "./passage-default";
import placementOrderingDefault from "./placement-ordering-default";
import quadraticEquation from "./quadratic-equation";
import rubricDefault from "./rubric-default";
import selectTextDefault from "./select-text-default";
import solarSystemMoons from "./solar-system-moons";
import waterCyclePassage from "./water-cycle-passage";

const importedDemos: DemoInfo[] = [
	categorizeAlgebraOperations,
	categorizeCalculusConcepts,
	categorizeGeometryShapes,
	categorizeMathEquations,
	chartingBarChartStatistics,
	chartingHistogramFrequency,
	chartingLineChartGrowth,
	complexRubric1,
	dragInTheBlankBasicSentence,
	dragInTheBlankChemistryDuplicates,
	dragInTheBlankMathEquations,
	dragInTheBlankWordProblemsImages,
	drawingResponseDefault,
	ebsrDefault,
	explicitConstructedResponseDefault,
	extendedTextEntryDefault,
	fractionModelPieImproperFraction,
	fractionModelSimpleBarHalves,
	fractionModelStudentConfigThirds,
	graphingLinearFunction,
	graphingParabolaVertex,
	graphingSineWaveTrigonometry,
	graphingSolutionSetInequalityDashedLine,
	graphingSolutionSetInequalitySolidLine,
	graphingSolutionSetSystemTwoInequalities,
	hotspotDefault,
	imageClozeAssociationDefault,
	inlineDropdownDefault,
	likertDefault,
	matchDefault,
	matchListDefault,
	mathInlineDefault,
	mathTemplatedDefault,
	matrixDefault,
	mcPopulatedBlankVariantSelR1Gplusggg,
	mcPopulatedBlankVariantSelR1GStem,
	mcPopulatedBlankVariantSelR1GgPlus,
	mcPopulatedBlankVariantSelR1Ggplus,
	mcPopulatedBlankVariantSelR1Plusggg,
	mcPopulatedBlankVariantSelR1S3,
	mcPopulatedBlankVariantSelVic,
	mcPopulatedBlankVariantSrVic,
	multiTraitRubricDefault,
	multipleChoiceBasicCheckbox,
	multipleChoiceMathAlgebraQuadratic,
	multipleChoiceMathGeometryTriangles,
	multipleChoiceNoPrefix,
	multipleChoiceNumbersPrefix,
	multipleChoiceRadioSimple,
	numberLineBasicPoints,
	numberLineFractionsDecimals,
	numberLineInequalityRays,
	numberLineIntervalsRanges,
	passageDefault,
	placementOrderingDefault,
	quadraticEquation,
	rubricDefault,
	selectTextDefault,
	solarSystemMoons,
	waterCyclePassage,
].sort((a, b) => {
	const pkg = a.sourcePackage.localeCompare(b.sourcePackage);
	return pkg === 0 ? a.id.localeCompare(b.id) : pkg;
});

export const demos: Record<string, DemoInfo> = Object.fromEntries(
	importedDemos.map((demo) => [demo.id, demo]),
);

export function getDemoById(id: string | undefined): DemoInfo | null {
	if (!id) return null;
	return demos[id] || null;
}

export function getAllDemos(): DemoInfo[] {
	return importedDemos;
}
