/**
 * Speed-rate bucketing utility
 * @module @pie-players/tts-server-core
 */

export type SpeedRateBucket = "slow" | "medium" | "fast";

/**
 * Bucket a numeric rate multiplier into the three-value vocabulary some
 * providers (SchoolCity, and backends modeled on it) accept instead of a
 * continuous rate. `0.95` / `1.5` is a deliberate tolerance band around the
 * `1.0` default rather than a strict `<1` / `>1` split, so small rate
 * perturbations near normal speed still read as `fallback` instead of
 * immediately flipping to `slow`/`fast`.
 */
export function resolveSpeedRateBucket(
	rate: number | undefined,
	fallback: SpeedRateBucket = "medium",
): SpeedRateBucket {
	const value = Number(rate ?? 1);
	if (!Number.isFinite(value)) return fallback;
	if (value <= 0.95) return "slow";
	if (value >= 1.5) return "fast";
	return fallback;
}
