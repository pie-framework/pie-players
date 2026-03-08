import {
	SECTION_PLAYER_PUBLIC_EVENTS,
	type SectionPlayerPublicEventName,
} from "../contracts/public-events.js";

const ALLOWED_EVENT_SET = new Set<SectionPlayerPublicEventName>(
	Object.values(SECTION_PLAYER_PUBLIC_EVENTS),
);

export function assertPublicEventName(eventName: string): asserts eventName is SectionPlayerPublicEventName {
	if (!ALLOWED_EVENT_SET.has(eventName as SectionPlayerPublicEventName)) {
		throw new Error(`Unsupported section-player public event: ${eventName}`);
	}
}
