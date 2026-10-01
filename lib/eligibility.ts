import type { Admission, Track } from "./types";

/** Whether a student with `score` can apply to this admission on `track`. */
export function isEligible(a: Admission, track: Track, score: number): boolean {
  const available = track === "general" ? a.general_available : a.parallel_available;
  const minimum = track === "general" ? a.general_minimum : a.parallel_minimum;
  return available && (minimum === null || minimum <= score);
}

export function eligibleTracks(a: Admission, score: number): Track[] {
  return (["general", "parallel"] as const).filter((t) => isEligible(a, t, score));
}

export function trackMinimum(a: Admission, track: Track): number | null {
  return track === "general" ? a.general_minimum : a.parallel_minimum;
}

export function trackConditions(a: Admission, track: Track): string | null {
  return track === "general" ? a.general_conditions : a.parallel_conditions;
}

export function formatScore(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}
