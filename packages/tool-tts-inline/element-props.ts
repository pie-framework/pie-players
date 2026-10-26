import type { TTSLayoutMode, TTSSpeedOption } from "@pie-players/pie-assessment-toolkit/tools/registration";

export type TtsInlineSize = "sm" | "md" | "lg";

/** Inputs shared by the component and its native element declaration. */
export interface TtsInlineProps {
	catalogId?: string;
	size?: TtsInlineSize;
	speedOptions?: TTSSpeedOption[];
	showSingleSpeedOption?: boolean;
	layoutMode?: TTSLayoutMode;
	/** Multiplies every speed choice's rate, so 1× reads at this rate. */
	baseRate?: number;
	/** The pitch each read starts at, 0–2 with 1 normal. */
	pitch?: number;
	/** The volume each read starts at, 0–1. */
	volume?: number;
}
