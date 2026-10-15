import { createPersonalNeedsProfileFromAfa } from "@pie-players/pie-default-tool-loaders";
import type {
	AssessmentSection,
	PersonalNeedsProfile,
} from "@pie-players/pie-players-shared/types";
import { demo2Section } from "./demo2-question-passage";

/**
 * Magnifier demo: the illustrated passage and question from the question-passage
 * demo, delivered under two profiles. The passage's prose, timeline image and
 * table give the lens text, raster and layout to magnify.
 */
export const demoMagnifierGrantedSection: AssessmentSection = {
	...demo2Section,
	identifier: "magnifier-granted",
	title: "Magnifier granted",
};

export const demoMagnifierProhibitedSection: AssessmentSection = {
	...demo2Section,
	identifier: "magnifier-prohibited",
	title: "Magnifier prohibited",
};

/**
 * Profiles by section identifier, each converted from an AfA PNP 3.0 record. The
 * grant's `all-content` becomes the `magnification` tool parameter `zoom`; the
 * `prohibit-set` entry becomes `prohibitedSupports`.
 */
export const demoMagnifierProfiles: Record<string, PersonalNeedsProfile> = {
	"magnifier-granted": createPersonalNeedsProfileFromAfa({
		magnification: { "all-content": 2.5 },
	}),
	"magnifier-prohibited": createPersonalNeedsProfileFromAfa({
		"prohibit-set": ["magnification"],
	}),
};
