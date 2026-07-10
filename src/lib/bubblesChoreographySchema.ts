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

export type BubblesEffect = "confetti" | "fireworks";

export const BUBBLES_EFFECTS: readonly BubblesEffect[] = [
  "confetti",
  "fireworks",
];

export const BUBBLES_EFFECT_LABELS: Record<BubblesEffect, string> = {
  confetti: "Confetti",
  fireworks: "Fireworks",
};

export type BubblesChoreographyStep = {
  mode: BubblesFormationMode;
  durationMs: number;
  effects?: BubblesEffect[];
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
    const rawEffects = (step as { effects?: unknown }).effects;
    const effects = Array.isArray(rawEffects)
      ? (rawEffects.filter(
          (e): e is BubblesEffect =>
            typeof e === "string" &&
            BUBBLES_EFFECTS.includes(e as BubblesEffect),
        ) as BubblesEffect[])
      : [];
    steps.push({
      mode: step.mode as BubblesFormationMode,
      durationMs: step.durationMs,
      ...(effects.length > 0 && { effects }),
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

// Save-time guardrails so an authored choreography can't misbehave on the wall.
export const MIN_STEP_SECONDS = 0.5;
export const MAX_STEP_SECONDS = 120;
// Confetti/fireworks steps shorter than this barely play (sound + fade need
// time), so we require a floor on any step that declares an effect.
export const MIN_EFFECT_STEP_SECONDS = 2;
export const MAX_STEPS = 20;
// Default show length (ms) when a wall has no animation_duration set. Matches the
// wall app's hope_wall.animation_duration default (join-milo).
export const DEFAULT_ANIMATION_DURATION_SECONDS = 300;

// Returns a list of human-readable blocking errors (empty === valid to save).
// maxTotalSeconds is the wall's animation_duration: the show stops after it, so
// non-looping steps past that never play.
export function validateChoreography(
  steps: readonly BubblesChoreographyStep[],
  loop: boolean,
  maxTotalSeconds: number = DEFAULT_ANIMATION_DURATION_SECONDS,
): string[] {
  const errors: string[] = [];
  if (steps.length === 0) {
    errors.push("Add at least one step before saving.");
    return errors;
  }
  if (steps.length > MAX_STEPS) {
    errors.push(`Too many steps — keep it to ${MAX_STEPS} or fewer.`);
  }
  steps.forEach((step, index) => {
    const seconds = step.durationMs / 1000;
    const n = index + 1;
    if (seconds < MIN_STEP_SECONDS) {
      errors.push(`Step ${n}: duration must be at least ${MIN_STEP_SECONDS}s.`);
    }
    if (seconds > MAX_STEP_SECONDS) {
      errors.push(`Step ${n}: duration must be at most ${MAX_STEP_SECONDS}s.`);
    }
    if ((step.effects?.length ?? 0) > 0 && seconds < MIN_EFFECT_STEP_SECONDS) {
      errors.push(
        `Step ${n}: steps with confetti/fireworks need at least ${MIN_EFFECT_STEP_SECONDS}s to play.`,
      );
    }
  });
  const totalSeconds = getChoreographyTotalMs(steps) / 1000;
  if (!loop && totalSeconds > maxTotalSeconds) {
    errors.push(
      `Total ${totalSeconds.toFixed(1)}s exceeds the wall's ${maxTotalSeconds}s animation duration — later steps won't play. Raise the animation duration, trim steps, or turn Loop on.`,
    );
  }
  return errors;
}
