export const ITEM_PLAYER_PUBLIC_EVENTS = {
	error: "player-error",
} as const;

export type ItemPlayerPublicEventName =
	(typeof ITEM_PLAYER_PUBLIC_EVENTS)[keyof typeof ITEM_PLAYER_PUBLIC_EVENTS];
