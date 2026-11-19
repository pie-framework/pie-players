/**
 * Speed-rate bucketing utility
 * @module @pie-players/pie-tts
 */

import type { SpeedRateBucket } from "./provider-interface.js";

/**
 * Bucket a numeric rate multiplier into the three-value vocabulary some
 * providers (SchoolCity, and backends modeled on it) accept instead of a
 * continuous rate. `0.95` / `1.05` is a tolerance band around the `1.0`
 * default, symmetric so every speed choice off normal reaches its bucket: the
 * default Fast choice is 1.25 and must send `fast`.
 */
export function resolveSpeedRateBucket(
	rate: number | undefined,
	fallback: SpeedRateBucket = "medium",
): SpeedRateBucket {
	const value = Number(rate ?? 1);
	if (!Number.isFinite(value)) return fallback;
	if (value <= 0.95) return "slow";
	if (value >= 1.05) return "fast";
	return fallback;
}
