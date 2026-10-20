import type { SummarizeFn } from "@pie-element/shared-types";
import { categorize } from "./categorize.js";
import { charting } from "./charting.js";
import { dragInTheBlank } from "./drag-in-the-blank.js";
import { drawingResponse } from "./drawing-response.js";
import { ebsr } from "./ebsr.js";
import { explicitConstructedResponse } from "./explicit-constructed-response.js";
import { extendedTextEntry } from "./extended-text-entry.js";
import { fractionModel } from "./fraction-model.js";
import { graphing } from "./graphing.js";
import { graphingSolutionSet } from "./graphing-solution-set.js";
import { hotspot } from "./hotspot.js";
import { imageClozeAssociation } from "./image-cloze-association.js";
import { inlineDropdown } from "./inline-dropdown.js";
import { likert } from "./likert.js";
import { match } from "./match.js";
import { matchList } from "./match-list.js";
import { mathInline } from "./math-inline.js";
import { mathTemplated } from "./math-templated.js";
import { matrix } from "./matrix.js";
import { multipleChoice } from "./multiple-choice.js";
import { numberLine } from "./number-line.js";
import { passage } from "./passage.js";
import { placementOrdering } from "./placement-ordering.js";
import { complexRubric, multiTraitRubric, rubric } from "./rubric.js";
import { selectText } from "./select-text.js";

/**
 * The bundled summarizers, by package name. They read every version of an element's model, so
 * lookup ignores the version an item pins.
 */
export const summarizers: Readonly<Record<string, SummarizeFn>> = Object.freeze({
	"@pie-element/categorize": categorize,
	"@pie-element/charting": charting,
	"@pie-element/complex-rubric": complexRubric,
	"@pie-element/drag-in-the-blank": dragInTheBlank,
	"@pie-element/drawing-response": drawingResponse,
	"@pie-element/ebsr": ebsr,
	"@pie-element/explicit-constructed-response": explicitConstructedResponse,
	"@pie-element/extended-text-entry": extendedTextEntry,
	"@pie-element/fraction-model": fractionModel,
	"@pie-element/graphing": graphing,
	"@pie-element/graphing-solution-set": graphingSolutionSet,
	"@pie-element/hotspot": hotspot,
	"@pie-element/image-cloze-association": imageClozeAssociation,
	"@pie-element/inline-dropdown": inlineDropdown,
	"@pie-element/likert": likert,
	"@pie-element/match": match,
	"@pie-element/match-list": matchList,
	"@pie-element/math-inline": mathInline,
	"@pie-element/math-templated": mathTemplated,
	"@pie-element/matrix": matrix,
	"@pie-element/multi-trait-rubric": multiTraitRubric,
	"@pie-element/multiple-choice": multipleChoice,
	"@pie-element/number-line": numberLine,
	"@pie-element/passage": passage,
	"@pie-element/placement-ordering": placementOrdering,
	"@pie-element/rubric": rubric,
	"@pie-element/select-text": selectText,
});
