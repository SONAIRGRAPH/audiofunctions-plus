import { useGraphContext } from "../../context/GraphContext";
import { useAnnouncement } from "../../context/AnnouncementContext";
import { useInfoToast } from "../../context/InfoToastContext";
import { useDialog } from "../../context/DialogContext";
import {
  getActiveFunctions,
  getFunctionNameN,
  getFunctionInstrumentN,
  setFunctionInstrumentN,
  getLandmarksN,
  findLandmarkByShortcut,
} from "../../utils/graphObjectOperations";
import {
  addLandmarkAtCursorPosition,
  removeLandmarkAtCursorPosition,
  jumpToLandmarkWithToast,
} from "../../utils/landmarkUtils";
import { nextStepSize, nextSpeed } from "../../utils/movementSettings";

/** Zooms the view around its centre, optionally along one axis only. */
export const useZoomBoard = () => {
  const { setGraphBounds } = useGraphContext();

  return (out, xOnly = false, yOnly = false) => {
    const scaleFactor = { x: 0.9, y: 0.9 };
    if (out) { scaleFactor.x = 1.1; scaleFactor.y = 1.1; }
    if (xOnly) scaleFactor.y = 1; //only x axis zoom
    if (yOnly) scaleFactor.x = 1; //only y axis zoom

    setGraphBounds(prevBounds => {
      const centerX = (prevBounds.xMin + prevBounds.xMax) / 2;
      const centerY = (prevBounds.yMin + prevBounds.yMax) / 2;
      const halfWidthX = (prevBounds.xMax - prevBounds.xMin) / 2 * scaleFactor.x;
      const halfWidthY = (prevBounds.yMax - prevBounds.yMin) / 2 * scaleFactor.y;

      return {
        xMin: centerX - halfWidthX,
        xMax: centerX + halfWidthX,
        yMin: centerY - halfWidthY,
        yMax: centerY + halfWidthY,
      };
    });
  };
};

/** Shifts the view so the cursor sits in the middle. */
export const useCenterAtCursor = () => {
  const { setGraphBounds, cursorCoords, graphBounds } = useGraphContext();
  const { announce } = useAnnouncement();
  const { showInfoToast } = useInfoToast();

  return () => {
    if (!cursorCoords || cursorCoords.length === 0) {
      announce("No cursor position available");
      return;
    }

    // Use the first cursor coordinate (primary cursor position)
    const currentCursor = cursorCoords[0];
    const cursorX = Number(currentCursor.x);
    const cursorY = Number(currentCursor.y);

    const { xMin, xMax, yMin, yMax } = graphBounds;

    // Shift the current bounds by the distance between cursor and current centre
    const offsetX = cursorX - (xMin + xMax) / 2;
    const offsetY = cursorY - (yMin + yMax) / 2;

    setGraphBounds({
      xMin: xMin + offsetX,
      xMax: xMax + offsetX,
      yMin: yMin + offsetY,
      yMax: yMax + offsetY,
    });

    const roundedX = Number(cursorX).toFixed(2);
    const roundedY = Number(cursorY).toFixed(2);
    announce(`View centered at cursor position: x = ${roundedX}, y = ${roundedY}`);
    showInfoToast(`Centered at (${roundedX}, ${roundedY})`, 1500);
  };
};

/**
 * What every command of the application does, keyed by command id. Used by
 * `usePaletteItems` and `KeyboardHandler`; the keys are in `hotkeys.js`.
 *
 * Rebuilt on every render, so each action closes over the current graph state.
 *
 * An action receives the KeyboardEvent when a key triggered it and nothing when the
 * palette did, so anything read from the event has to tolerate `undefined`.
 */
export function useCommands() {
  const {
    setIsAudioEnabled,
    PlayFunction,
    setPlayFunction,
    setGraphBounds,
    graphBounds,
    graphSettings,
    cursorCoords,
    updateCursor,
    stepSize,
    setStepSize,
    functionDefinitions,
    setFunctionDefinitions,
  } = useGraphContext();

  const { announce } = useAnnouncement();
  const { showInfoToast, showLandmarkToast } = useInfoToast();
  const { openDialog } = useDialog();

  const zoomBoard = useZoomBoard();
  const centerAtCursor = useCenterAtCursor();

  // --- helpers --------------------------------------------------------------

  const activeFunctions = getActiveFunctions(functionDefinitions);
  const activeFunction = activeFunctions.length > 0 ? activeFunctions[0] : null;
  const activeFunctionIndex = activeFunction
    ? functionDefinitions.findIndex(f => f.id === activeFunction.id)
    : -1;

  /** Pan the view. Shift pans five units at a time instead of one. */
  const pan = (axis, sign, event) => {
    const step = (event?.shiftKey ? 5 : 1) * sign;
    setGraphBounds(prev => axis === "x"
      ? { ...prev, xMin: prev.xMin + step, xMax: prev.xMax + step }
      : { ...prev, yMin: prev.yMin + step, yMax: prev.yMax + step });
  };

  /** Activate exactly one function, by index. */
  const showOnlyFunction = (targetIndex) => {
    if (!functionDefinitions || targetIndex < 0 || targetIndex >= functionDefinitions.length) return;

    setFunctionDefinitions(functionDefinitions.map((func, index) => ({
      ...func,
      isActive: index === targetIndex,
    })));

    const functionName = getFunctionNameN(functionDefinitions, targetIndex) || `Function ${targetIndex + 1}`;
    announce(`Switched to ${functionName}`);
    showInfoToast(`${functionName}`, 1500);
  };

  /** Current bounds and every landmark inside them, left to right. */
  const getSortedNavigationPoints = () => {
    if (!activeFunction) return [];

    const { xMin, xMax } = graphBounds;
    const visibleLandmarks = getLandmarksN(functionDefinitions, activeFunctionIndex)
      .filter(landmark => landmark.x >= xMin && landmark.x <= xMax)
      .sort((a, b) => a.x - b.x)
      .map(landmark => ({ type: 'landmark', x: landmark.x, label: landmark.label || 'Landmark', landmark }));

    return [
      { type: 'boundary', x: xMin, label: 'Left boundary' },
      ...visibleLandmarks,
      { type: 'boundary', x: xMax, label: 'Right boundary' },
    ];
  };

  /** Move the cursor to the next/previous landmark or view boundary, wrapping around. */
  const jumpToNavigationPoint = (direction) => {
    if (!cursorCoords || cursorCoords.length === 0) return;

    const currentX = parseFloat(cursorCoords[0].x);
    const navigationPoints = getSortedNavigationPoints();
    if (navigationPoints.length === 0) return;

    let targetPoint;
    if (direction === 1) {
      targetPoint = navigationPoints.find(point => point.x > currentX) ?? navigationPoints[0];
    } else {
      const leftPoints = navigationPoints.filter(point => point.x < currentX);
      targetPoint = leftPoints[leftPoints.length - 1] ?? navigationPoints[navigationPoints.length - 1];
    }

    updateCursor(targetPoint.x);
  };

  const showCoordinates = () => {
    if (!cursorCoords || cursorCoords.length === 0) {
      announce("No cursor position available");
      return;
    }

    const messages = cursorCoords.map(coord => {
      const functionIndex = functionDefinitions.findIndex(f => f.id === coord.functionId);
      const functionName = getFunctionNameN(functionDefinitions, functionIndex) || `Function ${functionIndex + 1}`;
      const roundedX = Number(coord.x).toFixed(2);
      const roundedY = Number(coord.y).toFixed(2);

      // Check if there's a landmark at the current position
      const landmarks = getLandmarksN(functionDefinitions, functionIndex);
      const epsilon = 0.01; // Small tolerance for floating point comparison
      const landmarkAtPosition = landmarks.find(landmark =>
        Math.abs(landmark.x - coord.x) < epsilon &&
        Math.abs(landmark.y - coord.y) < epsilon
      );

      let message = `${functionName}: `;
      if (landmarkAtPosition) {
        message += `"${landmarkAtPosition.label}" at \n`;
      }
      message += `x = ${roundedX}, y = ${roundedY}`;

      return message;
    });

    const message = messages.join('\n');
    announce(`Current Coordinates:\n\n${message}`);
    showInfoToast(`Current Coordinates:\n\n${message}`);
  };

  const showViewBounds = () => {
    const { xMin, xMax, yMin, yMax } = graphBounds;
    const message = `Current View Bounds:\n\nX: [${Number(xMin).toFixed(2)}, ${Number(xMax).toFixed(2)}]\nY: [${Number(yMin).toFixed(2)}, ${Number(yMax).toFixed(2)}]`;
    announce(message);
    showInfoToast(message);
  };

  /** Step through the functions, wrapping around at either end. */
  const switchFunctionBy = (offset) => {
    if (!functionDefinitions || functionDefinitions.length === 0) return;

    const count = functionDefinitions.length;
    const currentActiveIndex = functionDefinitions.findIndex(func => func.isActive);
    // No function active yet: start at the end the step comes from.
    const targetIndex = currentActiveIndex === -1
      ? (offset > 0 ? 0 : count - 1)
      : (currentActiveIndex + offset + count) % count;

    showOnlyFunction(targetIndex);
  };

  /** Switch every function between the discrete (guitar) and continuous (clarinet) instrument. */
  const toggleSonificationType = () => {
    if (!functionDefinitions || functionDefinitions.length === 0) return;

    const activeIndex = functionDefinitions.findIndex(func => func.isActive);
    if (activeIndex === -1) return;

    const currentInstrument = getFunctionInstrumentN(functionDefinitions, activeIndex);
    const newInstrument = currentInstrument === 'guitar' ? 'clarinet' : 'guitar';
    const sonificationType = newInstrument === 'guitar' ? 'discrete' : 'continuous';

    setFunctionDefinitions(functionDefinitions.map((func) =>
      setFunctionInstrumentN([func], 0, newInstrument)[0]
    ));

    announce(`Sonification type changed to ${sonificationType}`);
    showInfoToast(`Sonification type: ${sonificationType}`, 1500);
  };

  /** Both movement settings report their new value the same way. */
  const adjustStepSize = (direction) => {
    const value = nextStepSize(stepSize, direction);
    setStepSize(value);

    const message = `Step size: ${value}`;
    announce(message);
    showInfoToast(message, 1500);
  };

  const adjustSpeed = (direction) => {
    const value = nextSpeed(PlayFunction.speed, direction);
    setPlayFunction(prev => ({ ...prev, speed: value }));

    const message = `Speed: ${value}`;
    announce(message);
    showInfoToast(message, 1500);
  };

  const resetView = () => {
    const defaultView = graphSettings?.defaultView;
    if (defaultView && Array.isArray(defaultView) && defaultView.length === 4) {
      const [xMin, xMax, yMax, yMin] = defaultView;
      setGraphBounds({ xMin, xMax, yMin, yMax });
    } else {
      setGraphBounds({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 });
    }
    updateCursor(0);

    announce("View reset to default values");
    showInfoToast("Default view", 1500);
  };

  // --- the commands ---------------------------------------------------------

  return {
    'toggle-audio': () => setIsAudioEnabled(prev => !prev),
    'play-function': () => setPlayFunction(prev => ({ ...prev, source: "play", active: !prev.active })),
    // GraphView renders "play_space" differently from "play".
    'play-function-space': () => setPlayFunction(prev => ({ ...prev, source: "play_space", active: !prev.active })),
    'next-function': () => switchFunctionBy(1),
    'prev-function': () => switchFunctionBy(-1),
    'toggle-sonification-type': toggleSonificationType,
    'show-coordinates': showCoordinates,
    'show-view-bounds': showViewBounds,
    'center-at-cursor': centerAtCursor,
    'reset-view': resetView,

    // The keyboard overrides these two with a variant that honours a held X or Y key.
    'zoom-in': () => zoomBoard(false),
    'zoom-out': () => zoomBoard(true),

    'pan-left': (event) => pan("x", -1, event),
    'pan-right': (event) => pan("x", 1, event),
    'pan-up': (event) => pan("y", 1, event),
    'pan-down': (event) => pan("y", -1, event),

    'increase-step-size': () => adjustStepSize(1),
    'decrease-step-size': () => adjustStepSize(-1),
    'increase-speed': () => adjustSpeed(1),
    'decrease-speed': () => adjustSpeed(-1),

    'cursor-start': () => updateCursor(graphBounds.xMin),
    'cursor-end': () => updateCursor(graphBounds.xMax),
    'prev-landmark': () => jumpToNavigationPoint(-1),
    'next-landmark': () => jumpToNavigationPoint(1),

    'add-landmark': () => addLandmarkAtCursorPosition(
      functionDefinitions,
      cursorCoords,
      setFunctionDefinitions,
      announce,
      showInfoToast,
      openDialog,
    ),

    // Straight to a landmark with its default label, shortcut and shape.
    'add-landmark-quick': () => addLandmarkAtCursorPosition(
      functionDefinitions,
      cursorCoords,
      setFunctionDefinitions,
      announce,
      showInfoToast,
      openDialog,
      { openEditor: false },
    ),

    // Only removes something when the cursor stands on a landmark.
    'delete-landmark': () => removeLandmarkAtCursorPosition(
      functionDefinitions,
      cursorCoords,
      setFunctionDefinitions,
      announce,
      showInfoToast,
    ),

    'functions-menu': () => openDialog("edit-function"),
    'movement-adjustments': () => openDialog("movement-adjustments"),
    'help': () => openDialog("welcome"),

    // Parameterised — bound per digit, see NUMBERED_HOTKEYS.
    'show-function': (index) => showOnlyFunction(index),
    'jump-to-landmark': (digit) => {
      if (activeFunctionIndex === -1) return;
      const landmark = findLandmarkByShortcut(functionDefinitions, activeFunctionIndex, digit);
      if (landmark) jumpToLandmarkWithToast(landmark, updateCursor, graphBounds, announce, showLandmarkToast);
    },

    // Used by the palette's landmark entries, which pass the landmark itself.
    'jump-to-landmark-object': (landmark) =>
      jumpToLandmarkWithToast(landmark, updateCursor, graphBounds, announce, showLandmarkToast),
  };
}
