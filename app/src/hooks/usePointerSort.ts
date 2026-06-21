'use client';

import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

/**
 * Unified pointer-events drag-to-sort for both mouse and touch.
 *
 * - Mouse: a >5px move on an item starts the drag immediately (native feel).
 * - Touch: a ~250ms long-press lifts the item; if the finger moves >10px before
 *   that, it's treated as a scroll and the gesture is abandoned (so normal
 *   swipes still scroll the list). During a drag the container's `touch-action`
 *   is set to `none` and pointermove is `preventDefault`ed so the page doesn't
 *   scroll. Drop targets are found via `elementFromPoint().closest([attr])`.
 *
 * Items must carry the `attr` data-attribute (e.g. `data-image-id`). Attach the
 * returned `onPointerDown(id, event)` to each item. Commit happens via `onDrop`
 * (the caller reads its own dragged/over state, exactly like the old HTML5 path).
 */
export interface PointerSortOptions {
  containerRef: RefObject<HTMLElement | null>;
  /** data-* attribute carrying each item's id, e.g. 'data-image-id'. */
  attr: string;
  /** Drag actually begins (item lifted). */
  onLift: (id: string) => void;
  /** Pointer moved over another sortable item. */
  onOver: (overId: string) => void;
  /** Pointer released over a target — commit the reorder. */
  onDrop: () => void;
  /** Gesture ended without a drop (cancel/escape). */
  onCancel?: () => void;
}

const LONG_PRESS_MS = 250;
const MOUSE_THRESHOLD = 5;
const TOUCH_SCROLL_THRESHOLD = 10;

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  id: string;
  el: HTMLElement;
  isTouch: boolean;
  mode: 'pending' | 'dragging';
  timer: number | null;
}

function makeController(cb: RefObject<PointerSortOptions>) {
  let gesture: Gesture | null = null;

  const idOf = (node: Element | null): string | null => {
    const sel = `[${cb.current.attr}]`;
    const el = node?.closest(sel) as HTMLElement | null;
    return el?.getAttribute(cb.current.attr) ?? null;
  };

  const begin = () => {
    if (!gesture || gesture.mode === 'dragging') return;
    gesture.mode = 'dragging';
    if (gesture.timer) {
      clearTimeout(gesture.timer);
      gesture.timer = null;
    }
    try {
      gesture.el.setPointerCapture(gesture.pointerId);
    } catch {
      /* element may be gone */
    }
    const c = cb.current.containerRef.current;
    if (c) c.style.touchAction = 'none'; // suppress scroll while dragging
    cb.current.onLift(gesture.id);
  };

  const finish = (commit: boolean) => {
    if (!gesture) return;
    if (gesture.timer) clearTimeout(gesture.timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancelEv);
    try {
      gesture.el.releasePointerCapture(gesture.pointerId);
    } catch {
      /* ignore */
    }
    const c = cb.current.containerRef.current;
    if (c) c.style.touchAction = '';
    const wasDragging = gesture.mode === 'dragging';
    gesture = null;
    if (wasDragging) {
      if (commit) cb.current.onDrop();
      else cb.current.onCancel?.();
    }
  };

  const onMove = (e: PointerEvent) => {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    const dist = Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY);
    if (gesture.mode === 'pending') {
      if (gesture.isTouch) {
        if (dist > TOUCH_SCROLL_THRESHOLD) finish(false); // it's a scroll, let it go
      } else if (dist > MOUSE_THRESHOLD) {
        begin();
      }
      return;
    }
    e.preventDefault();
    const overId = idOf(document.elementFromPoint(e.clientX, e.clientY));
    if (overId) cb.current.onOver(overId);
  };

  const onUp = (e: PointerEvent) => {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    finish(true);
  };

  const onCancelEv = (e: PointerEvent) => {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    finish(false);
  };

  const onPointerDown = (id: string, e: ReactPointerEvent) => {
    if (gesture) return; // one gesture at a time
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Leave interactive children (buttons, inputs, the Details editor) alone.
    if (
      target.closest(
        'button, input, textarea, select, a, [role="combobox"], [role="listbox"], [contenteditable="true"]'
      )
    ) {
      return;
    }
    const el = (target.closest(`[${cb.current.attr}]`) as HTMLElement) ?? (e.currentTarget as HTMLElement);
    const isTouch = e.pointerType !== 'mouse';
    gesture = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      id,
      el,
      isTouch,
      mode: 'pending',
      timer: isTouch ? window.setTimeout(begin, LONG_PRESS_MS) : null,
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancelEv);
  };

  const dispose = () => {
    if (gesture) finish(false);
  };

  return { onPointerDown, dispose };
}

export function usePointerSort(opts: PointerSortOptions): {
  onPointerDown: (id: string, e: ReactPointerEvent) => void;
} {
  const cb = useRef(opts);
  cb.current = opts;
  const ctrl = useRef<ReturnType<typeof makeController> | null>(null);
  if (!ctrl.current) ctrl.current = makeController(cb);
  useEffect(() => ctrl.current?.dispose, []);
  return { onPointerDown: ctrl.current.onPointerDown };
}
