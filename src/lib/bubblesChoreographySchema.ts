// Bubble-movement choreography stored in hope_wall.bubbles_choreography (jsonb).
// Kept in sync with the wall app (join-milo: src/lib/hope-wall/bubbles-choreography.ts).
// Shape: { steps: [{ mode, durationMs }], loop }

export type BubblesFormationMode =
  | "movement"
  | "heart"
  | "circle"
  | "digit-1"
  | "digit-2"
  | "digit-3"
  | "orbit";

export type BubblesChoreographyStep = {
  mode: BubblesFormationMode;
  durationMs: number;
};

export type BubblesChoreography = {
  steps: BubblesChoreographyStep[];
  loop: boolean;
};

export const BUBBLES_FORMATION_MODES: readonly BubblesFormationMode[] = [
  "movement",
  "heart",
  "circle",
  "digit-1",
  "digit-2",
  "digit-3",
  "orbit",
];

// Short human hint per mode, shown in the editor.
export const BUBBLES_FORMATION_LABELS: Record<BubblesFormationMode, string> = {
  movement: "Free movement",
  heart: "Heart",
  circle: "Big rotating circle (1-2 visit center)",
  "digit-1": "Digit 1",
  "digit-2": "Digit 2",
  "digit-3": "Digit 3",
  orbit: "Orbit (rotating rings)",
};

export function parseBubblesChoreography(
  value: unknown,
): BubblesChoreography | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as { steps?: unknown; loop?: unknown };
  if (!Array.isArray(candidate.steps)) {
    return null;
  }
  const steps: BubblesChoreographyStep[] = [];
  for (const rawStep of candidate.steps) {
    if (!rawStep || typeof rawStep !== "object") {
      continue;
    }
    const step = rawStep as { mode?: unknown; durationMs?: unknown };
    if (
      typeof step.mode !== "string" ||
      !BUBBLES_FORMATION_MODES.includes(step.mode as BubblesFormationMode) ||
      typeof step.durationMs !== "number" ||
      !Number.isFinite(step.durationMs) ||
      step.durationMs <= 0
    ) {
      continue;
    }
    steps.push({
      mode: step.mode as BubblesFormationMode,
      durationMs: step.durationMs,
    });
  }
  if (steps.length === 0) {
    return null;
  }
  return { steps, loop: candidate.loop !== false };
}

export function getChoreographyTotalMs(
  steps: readonly BubblesChoreographyStep[],
): number {
  return steps.reduce((total, step) => total + step.durationMs, 0);
}
