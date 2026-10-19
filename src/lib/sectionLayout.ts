import { useCallback, useMemo, useSyncExternalStore } from "react";

// Order and open/closed state of the arrangeable sections on the Blog
// articles tab (Content, Bucket / Media, Performance overview). Remembered per
// browser in localStorage — a convenience only: when storage is unavailable
// the page falls back to the default layout.

export type SectionId = "content" | "bucket" | "performance";

export const DEFAULT_ORDER: SectionId[] = ["content", "bucket", "performance"];
// Performance fetches readership when opened, so it starts closed.
export const DEFAULT_CLOSED: SectionId[] = ["performance"];

export interface SectionLayoutState {
  order: SectionId[];
  closed: SectionId[];
}

const STORAGE_KEY = "cms.blogSectionLayout";
const CHANGE_EVENT = "cms:section-layout";

// Keep only known ids, drop duplicates, and append any section a stored layout
// predates, so adding a section later never hides it.
export function normalizeLayout(raw: unknown): SectionLayoutState {
  const known = new Set<string>(DEFAULT_ORDER);
  const pick = (value: unknown): SectionId[] =>
    Array.isArray(value)
      ? Array.from(
          new Set(
            value.filter(
              (id): id is SectionId => typeof id === "string" && known.has(id),
            ),
          ),
        )
      : [];

  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const order = pick(source.order);
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
  const closed = Array.isArray(source.closed)
    ? pick(source.closed)
    : [...DEFAULT_CLOSED];
  return { order, closed };
}

// Swap a section with its neighbour; no-op at either end.
export function moveSection(
  order: SectionId[],
  id: SectionId,
  delta: -1 | 1,
): SectionId[] {
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// Fallback copy when localStorage throws (private mode, blocked storage), so
// changes still apply for the current page session.
let memory: string | null = null;

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(state: SectionLayoutState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    memory = JSON.stringify(state);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function parse(raw: string | null): SectionLayoutState {
  if (!raw) return normalizeLayout(null);
  try {
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return normalizeLayout(null);
  }
}

export interface SectionControls {
  open: boolean;
  onToggle: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function useSectionLayout() {
  // Server render and first client render use the default layout; the stored
  // one applies right after hydration, without a mismatch.
  const raw = useSyncExternalStore(
    subscribe,
    () => readStored() ?? memory,
    () => null,
  );
  const state = useMemo(() => parse(raw), [raw]);

  const update = useCallback(
    (change: (current: SectionLayoutState) => SectionLayoutState) => {
      writeStored(change(parse(readStored() ?? memory)));
    },
    [],
  );

  // Number and controls for one section. `number` follows the current order,
  // starting after the fixed sections (1. Connection, 2. Articles).
  const sectionFor = useCallback(
    (
      id: SectionId,
      arrangeable = true,
    ): { number: number; controls: SectionControls } => {
      const index = state.order.indexOf(id);
      const controls: SectionControls = {
        open: !state.closed.includes(id),
        onToggle: () =>
          update((s) => ({
            ...s,
            closed: s.closed.includes(id)
              ? s.closed.filter((c) => c !== id)
              : [...s.closed, id],
          })),
        onMoveUp:
          arrangeable && index > 0
            ? () =>
                update((s) => ({ ...s, order: moveSection(s.order, id, -1) }))
            : undefined,
        onMoveDown:
          arrangeable && index < state.order.length - 1
            ? () =>
                update((s) => ({ ...s, order: moveSection(s.order, id, 1) }))
            : undefined,
      };
      return { number: index + 3, controls };
    },
    [state, update],
  );

  return { order: state.order, sectionFor };
}
