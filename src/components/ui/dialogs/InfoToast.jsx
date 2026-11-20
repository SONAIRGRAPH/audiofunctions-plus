import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useGraphContext } from "../../../context/GraphContext";
import { getScreenPosition, validateActiveFunction } from "../../../utils/landmarkUtils";

// Distance between a toast and the graph border, in px
const EDGE_PADDING = 8;
// Distance between a toast and its cursor point, in px
const CURSOR_GAP = 14;
// Vertical distance between toasts that had to be pushed apart, in px
const STACK_GAP = 4;

/** The cursor of the given function, or null if it is not visible on the chart. */
function getVisibleCursor(functionId, cursorCoords, graphBounds) {
  const coord = cursorCoords?.find((c) => c.functionId === functionId);
  if (!coord) return null;

  const x = Number(coord.x);
  const y = Number(coord.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (y < graphBounds.yMin || y > graphBounds.yMax) return null;

  return { x, y };
}

/**
 * Screen position for a toast centered above its cursor, kept fully inside
 * the chart. Shifted sideways at the left/right border, flipped below the
 * cursor when there is no room above.
 */
function computeCursorPlacement(size, cursor, chartRect, graphBounds) {
  const { width, height } = size;
  const { x: cx, y: cy } = getScreenPosition(cursor.x, cursor.y, graphBounds);

  const minLeft = chartRect.left + EDGE_PADDING;
  const maxLeft = chartRect.right - EDGE_PADDING - width;
  const minTop = chartRect.top + EDGE_PADDING;
  const maxTop = chartRect.bottom - EDGE_PADDING - height;

  let top = cy - CURSOR_GAP - height;
  if (top < minTop) {
    top = cy + CURSOR_GAP;
  }
  top = Math.max(minTop, Math.min(top, maxTop));

  // If the toast is wider than the chart, pin it to the left border
  const left = Math.max(minLeft, Math.min(cx - width / 2, maxLeft));

  return { left, top, width, height };
}

function collide(a, b) {
  const horizontal = a.left < b.left + b.width && b.left < a.left + a.width;
  const vertical = a.top < b.top + b.height + STACK_GAP && b.top < a.top + a.height + STACK_GAP;
  return horizontal && vertical;
}

/**
 * Pushes overlapping toasts apart vertically, e.g. when two cursors meet at an
 * intersection. Toasts only move downwards first; if the stack then leaves
 * the chart, it is pushed back up from the bottom.
 */
function resolveOverlaps(placements, chartRect) {
  const items = placements.map((p) => ({ ...p })).sort((a, b) => a.top - b.top);
  const minTop = chartRect.top + EDGE_PADDING;
  const maxBottom = chartRect.bottom - EDGE_PADDING;

  for (let i = 1; i < items.length; i++) {
    let moved = true;
    while (moved) {
      moved = false;
      for (let j = 0; j < i; j++) {
        if (collide(items[i], items[j])) {
          items[i].top = items[j].top + items[j].height + STACK_GAP;
          moved = true;
        }
      }
    }
  }

  for (let i = items.length - 1; i >= 0; i--) {
    items[i].top = Math.min(items[i].top, maxBottom - items[i].height);
    let moved = true;
    while (moved) {
      moved = false;
      for (let j = i + 1; j < items.length; j++) {
        if (collide(items[i], items[j])) {
          items[i].top = items[j].top - STACK_GAP - items[i].height;
          moved = true;
        }
      }
    }
    // Without enough room the toasts overlap rather than leave the chart
    items[i].top = Math.max(items[i].top, minTop);
  }

  return items;
}

function sameBounds(a, b) {
  return a.xMin === b.xMin && a.xMax === b.xMax && a.yMin === b.yMin && a.yMax === b.yMax;
}

const BUBBLE_CLASSES = "bg-background border border-border rounded-lg shadow-lg px-3 py-2";
const TEXT_CLASSES = "text-sm text-txt whitespace-pre-line";

const InfoToast = ({
  message,
  isVisible,
  onClose,
  timeout = 10000,
  position = "cursor", // "cursor" or "corner"
  perCursor = null, // { [functionId]: text } -- one toast per cursor
  dismissOnGraphInteraction = false,
  showId = 0,
}) => {
  const { functionDefinitions, cursorCoords, graphBounds } = useGraphContext();
  const [shouldRender, setShouldRender] = useState(false);
  // key -> {left, top} once measured, null if it could not be placed
  const [placements, setPlacements] = useState({});
  const [resizeTick, setResizeTick] = useState(0);
  const bubbleRefs = useRef(new Map());
  const snapshotRef = useRef(null);

  // The provider recreates onClose on every render; keep the latest one in a
  // ref so it does not restart the auto-hide timer.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isVisible && message) {
      setShouldRender(true);
      // Auto-hide after specified timeout (default 10 seconds)
      const timer = setTimeout(() => {
        onCloseRef.current?.();
      }, timeout);

      return () => clearTimeout(timer);
    } else {
      // Delay unmounting to allow exit animation
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isVisible, message, timeout, showId]);

  // Which toasts go to a cursor and which text ends up in the corner.
  // General toasts sit at the first active function's cursor.
  const cursorBubbles = [];
  const cornerLines = [];
  if (position === "cursor") {
    const entries = perCursor
      ? functionDefinitions
          .filter((f) => perCursor[f.id] !== undefined)
          .map((f) => ({ key: f.id, functionId: f.id, text: perCursor[f.id] }))
      : [{
          key: "main",
          functionId: validateActiveFunction(functionDefinitions, cursorCoords).activeFunction?.id,
          text: message,
        }];

    entries.forEach((entry) => {
      const anchor = getVisibleCursor(entry.functionId, cursorCoords, graphBounds);
      if (anchor) {
        cursorBubbles.push({ ...entry, anchor });
      } else {
        cornerLines.push(entry.text);
      }
    });
  } else {
    cornerLines.push(message);
  }

  // Changes whenever a toast has to move -- keeps the layout effect cheap
  const anchorsKey = cursorBubbles
    .map((b) => `${b.key}:${b.anchor.x}:${b.anchor.y}:${b.text}`)
    .join("|");

  // Follow the cursors. Runs before paint, so no toast flashes at a wrong
  // position.
  useLayoutEffect(() => {
    if (!shouldRender || cursorBubbles.length === 0) {
      setPlacements({});
      return;
    }

    const chart = document.getElementById("jxgbox");
    if (!chart) {
      setPlacements(Object.fromEntries(cursorBubbles.map((b) => [b.key, null])));
      return;
    }
    const chartRect = chart.getBoundingClientRect();

    const measured = cursorBubbles
      .map((bubble) => {
        const element = bubbleRefs.current.get(bubble.key);
        if (!element) return null;
        const { width, height } = element.getBoundingClientRect();
        return { key: bubble.key, ...computeCursorPlacement({ width, height }, bubble.anchor, chartRect, graphBounds) };
      })
      .filter(Boolean);

    const resolved = resolveOverlaps(measured, chartRect);
    setPlacements(Object.fromEntries(resolved.map(({ key, left, top }) => [key, { left, top }])));
    // cursorBubbles is rebuilt every render; anchorsKey captures its content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender, anchorsKey, graphBounds, resizeTick]);

  useEffect(() => {
    if (position !== "cursor" || !shouldRender) return;
    const onResize = () => setResizeTick((tick) => tick + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position, shouldRender]);

  // Snapshot toasts (coordinates, bounds) disappear on the next graph
  // interaction instead of travelling along with stale values. All cursors
  // share one x, so the first active one stands for all of them.
  const activeCursorX = validateActiveFunction(functionDefinitions, cursorCoords).cursorCoord?.x;
  useEffect(() => {
    if (!dismissOnGraphInteraction || !isVisible) {
      snapshotRef.current = null;
      return;
    }
    const snapshot = snapshotRef.current;
    if (!snapshot || snapshot.showId !== showId) {
      snapshotRef.current = { showId, cursorX: activeCursorX, bounds: graphBounds };
      return;
    }
    if (snapshot.cursorX !== activeCursorX || !sameBounds(snapshot.bounds, graphBounds)) {
      snapshotRef.current = null;
      onCloseRef.current?.();
    }
  }, [dismissOnGraphInteraction, isVisible, showId, activeCursorX, graphBounds]);

  if (!shouldRender) {
    return null;
  }

  // Toasts that could not be placed (no chart element) join the corner
  const placedBubbles = cursorBubbles.filter((b) => placements[b.key] !== null);
  const allCornerLines = [
    ...cursorBubbles.filter((b) => placements[b.key] === null).map((b) => b.text),
    ...cornerLines,
  ];

  // w-max: the width must not depend on where a toast sits, otherwise the
  // size measured for the placement would be stale after moving it.
  const fade = isVisible ? "opacity-100" : "opacity-0";

  return (
    <>
      {placedBubbles.map((bubble) => {
        const placement = placements[bubble.key];
        // Not measured yet: rendered invisibly once, placed before paint
        const style = placement
          ? { left: `${placement.left}px`, top: `${placement.top}px` }
          : { left: 0, top: 0, visibility: "hidden" };
        return (
          <div
            key={bubble.key}
            ref={(element) => {
              if (element) bubbleRefs.current.set(bubble.key, element);
              else bubbleRefs.current.delete(bubble.key);
            }}
            className={`fixed z-40 pointer-events-none w-max max-w-sm transition-opacity duration-300 ease-in-out ${fade}`}
            style={style}
            aria-hidden="true"
            role="presentation"
          >
            <div className={BUBBLE_CLASSES}>
              <div className={TEXT_CLASSES}>{bubble.text}</div>
            </div>
          </div>
        );
      })}

      {allCornerLines.length > 0 && (
        <div
          className={`fixed top-24 right-4 z-40 w-max max-w-sm transition-all duration-300 ease-in-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
          aria-hidden="true"
          role="presentation"
        >
          <div className={BUBBLE_CLASSES}>
            <div className={TEXT_CLASSES}>{allCornerLines.join("\n")}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default InfoToast;
