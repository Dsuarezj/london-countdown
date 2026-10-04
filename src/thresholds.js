import { HOUR_MS } from "@/meeting-time.js";

export function findActiveThreshold(thresholds, remainingMs) {
  if (remainingMs <= 0) {
    return undefined;
  }
  return thresholds
    .filter((threshold) => remainingMs <= threshold.withinHours * HOUR_MS)
    .sort((first, second) => first.withinHours - second.withinHours)[0];
}
