import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useGraphContext } from "../../../context/GraphContext";
import { getScreenPosition, validateActiveFunction } from "../../../utils/landmarkUtils";

// Distance between the toast and the graph border, in px
const EDGE_PADDING = 8;
// Distance between the toast and the cursor point, in px
const CURSOR_GAP = 14;

/** The active function's cursor, or null if it is not visible on the chart. */
function getVisibleCursor(functionDefinitions, cursorCoords, graphBounds) {
  const { valid, cursorCoord } = validateActiveFunction(functionDefinitions, cursorCoords);
  if (!valid) return null;

  const x = Number(cursorCoord.x);
  const y = Number(cursorCoord.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (y < graphBounds.yMin || y > graphBounds.yMax) return null;

  return { x, y };
}

/**
 * Screen position for a toast centered above the cursor, kept fully inside the
 * graph area. Shifted sideways at the left/right border, flipped below the
 * cursor when there is no room above. Returns null if there is nothing to
 * anchor to, in which case the toast falls back to the corner.
 */
function computeCursorPlacement(toast, cursor, graphBounds) {
  const chart = document.getElementById("jxgbox");
  if (!toast || !chart || !cursor) return null;

  const chartRect = chart.getBoundingClientRect();
  const { width, height } = toast.getBoundingClientRect();
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

  return { left, top };
}

function sameBounds(a, b) {
  return a.xMin === b.xMin && a.xMax === b.xMax && a.yMin === b.yMin && a.yMax === b.yMax;
}

const InfoToast = ({
  message,
  isVisible,
  onClose,
  timeout = 10000,
  position = "cursor", // "cursor" or "corner"
  dismissOnGraphInteraction = false,
  showId = 0,
}) => {
  const { functionDefinitions, cursorCoords, graphBounds } = useGraphContext();
  const [shouldRender, setShouldRender] = useState(false);
  const [placement, setPlacement] = useState(null);
  const [resizeTick, setResizeTick] = useState(0);
  const toastRef = useRef(null);
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

  const cursor = getVisibleCursor(functionDefinitions, cursorCoords, graphBounds);
  const cursorX = cursor?.x;
  const cursorY = cursor?.y;

  // Follow the cursor. Runs before paint, so the toast never flashes at a
  // wrong position.
  useLayoutEffect(() => {
    if (position !== "cursor" || !shouldRender) {
      setPlacement(null);
      return;
    }
    const anchor = cursorX === undefined ? null : { x: cursorX, y: cursorY };
    setPlacement(computeCursorPlacement(toastRef.current, anchor, graphBounds));
  }, [position, shouldRender, message, cursorX, cursorY, graphBounds, resizeTick]);

  useEffect(() => {
    if (position !== "cursor" || !shouldRender) return;
    const onResize = () => setResizeTick((tick) => tick + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position, shouldRender]);

  // Snapshot toasts (coordinates, bounds) disappear on the next graph
  // interaction instead of travelling along with stale values.
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

  // w-max below: the width must not depend on where the toast sits, otherwise
  // the size measured for the placement would be stale after moving it.

  // Without a visible cursor the toast falls back to the corner
  const atCursor = position === "cursor" && placement !== null;

  const positionClasses = atCursor
    ? "fixed z-40 pointer-events-none transition-opacity"
    : "fixed top-24 right-4 z-40 transition-all";

  const animationClasses = isVisible
    ? "opacity-100 translate-y-0"
    : atCursor ? "opacity-0" : "opacity-0 -translate-y-2";

  const style = atCursor ? { left: `${placement.left}px`, top: `${placement.top}px` } : undefined;

  return (
    <div
      ref={toastRef}
      className={`${positionClasses} w-max max-w-sm duration-300 ease-in-out ${animationClasses}`}
      style={style}
      aria-hidden="true"
      role="presentation"
    >
      <div className="bg-background border border-border rounded-lg shadow-lg px-3 py-2">
        <div className="text-sm text-txt whitespace-pre-line">
          {message}
        </div>
      </div>
    </div>
  );
};

export default InfoToast;
