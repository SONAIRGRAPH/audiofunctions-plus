import { getActiveFunctions, getLandmarksN, addLandmarkWithValidation, removeLandmarkWithValidation } from './graphObjectOperations';

// Same tolerance findLandmarkAtPosition uses, and wide enough for the two decimals the
// cursor coordinates are rounded to.
const LANDMARK_X_TOLERANCE = 0.01;

/**
 * Calculate screen position from graph coordinates
 * @param {number} graphX - X coordinate in graph space
 * @param {number} graphY - Y coordinate in graph space
 * @param {Object} graphBounds - Graph bounds object
 * @returns {Object} Screen position {x, y}
 */
export function getScreenPosition(graphX, graphY, graphBounds) {
  const chartElement = document.getElementById('jxgbox');

  if (!chartElement) {
    console.warn('Chart element not found, using fallback position');
    return { x: 150, y: 150 };
  }

  const chartRect = chartElement.getBoundingClientRect();

  const xRange = graphBounds.xMax - graphBounds.xMin;
  const yRange = graphBounds.yMax - graphBounds.yMin;

  if (xRange === 0 || yRange === 0) {
    console.warn('Invalid graph bounds range');
    return { x: 150, y: 150 };
  }

  const relativeX = (graphX - graphBounds.xMin) / xRange;
  const relativeY = (graphBounds.yMax - graphY) / yRange;

  const screenX = chartRect.left + (relativeX * chartRect.width);
  const screenY = chartRect.top + (relativeY * chartRect.height);

  return { x: screenX, y: screenY };
}

/**
 * Show landmark toast at position with consistent formatting
 * @param {Object} landmark - Landmark object
 * @param {Object} screenPosition - Screen position {x, y}
 * @param {number} duration - Toast duration in ms
 * @param {Function} showLandmarkToast - Toast display function
 */
export function showLandmarkToastAtPosition(landmark, screenPosition, duration, showLandmarkToast) {
  const message = `${landmark.label || 'Landmark'}: x = ${landmark.x.toFixed(2)}, y = ${landmark.y.toFixed(2)}`;
  showLandmarkToast(message, screenPosition, duration);
}

/**
 * Jump to landmark with toast and announcement
 * @param {Object} landmark - Landmark object
 * @param {Function} updateCursor - Cursor update function
 * @param {Object} graphBounds - Graph bounds object
 * @param {Function} announce - Announcement function
 * @param {Function} showLandmarkToast - Toast display function
 */
export function jumpToLandmarkWithToast(landmark, updateCursor, graphBounds, announce, showLandmarkToast) {
  updateCursor(landmark.x);

  // const screenPosition = getScreenPosition(landmark.x, landmark.y, graphBounds);
  // showLandmarkToastAtPosition(landmark, screenPosition, 2000, showLandmarkToast);

  // Play landmark earcon immediately when jumping via shortcut
  // This ensures the earcon plays even if cursor was already at the landmark

  // Announce for screen readers
  // announce(`Jumped to ${landmark.label || 'landmark'} at x = ${landmark.x.toFixed(2)}, y = ${landmark.y.toFixed(2)}`);
}

/**
 * Validate active function and cursor position
 * @param {Array} functionDefinitions - Function definitions array
 * @param {Array} cursorCoords - Cursor coordinates array
 * @returns {Object} Validation result with activeFunction, activeFunctionIndex, cursorCoord
 */
export function validateActiveFunction(functionDefinitions, cursorCoords) {
  const activeFunctions = getActiveFunctions(functionDefinitions);
  if (activeFunctions.length === 0) {
    return {
      valid: false,
      message: "No active function available",
      activeFunction: null,
      activeFunctionIndex: -1,
      cursorCoord: null
    };
  }

  const activeFunction = activeFunctions[0];
  const activeFunctionIndex = functionDefinitions.findIndex(f => f.id === activeFunction.id);

  if (!cursorCoords || cursorCoords.length === 0) {
    return {
      valid: false,
      message: "No cursor position available",
      activeFunction,
      activeFunctionIndex,
      cursorCoord: null
    };
  }

  const cursorCoord = cursorCoords.find(coord => coord.functionId === activeFunction.id);
  if (!cursorCoord) {
    return {
      valid: false,
      message: "No cursor position for active function",
      activeFunction,
      activeFunctionIndex,
      cursorCoord: null
    };
  }

  return {
    valid: true,
    message: "Valid",
    activeFunction,
    activeFunctionIndex,
    cursorCoord
  };
}

/**
 * Find landmark at position with tolerance
 * @param {Array} landmarks - Landmarks array
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} tolerance - Position tolerance (default: 0.01)
 * @returns {Object} Result with found landmark index or -1
 */
export function findLandmarkAtPosition(landmarks, x, y, tolerance = 0.01) {
  const existingLandmarkIndex = landmarks.findIndex(landmark =>
    Math.abs(landmark.x - x) < tolerance && Math.abs(landmark.y - y) < tolerance
  );

  return {
    found: existingLandmarkIndex !== -1,
    index: existingLandmarkIndex,
    landmark: existingLandmarkIndex !== -1 ? landmarks[existingLandmarkIndex] : null
  };
}

/**
 * Handle existing landmark found scenario
 * @param {Object} landmark - Existing landmark
 * @param {number} landmarkIndex - Landmark index
 * @param {number} functionIndex - Function index
 * @param {Function} openDialog - Dialog opening function
 * @param {Function} announce - Announcement function
 */
export function handleExistingLandmarkFound(landmark, landmarkIndex, functionIndex, openDialog, announce) {
  announce(`Opening existing landmark at x = ${landmark.x.toFixed(2)}, y = ${landmark.y.toFixed(2)}`);

  openDialog("edit-landmark", {
    landmarkData: {
      functionIndex: functionIndex,
      landmarkIndex: landmarkIndex,
      landmark: landmark,
      isNewLandmark: false
    }
  });
}

/**
 * Add landmark at cursor position with full validation
 * @param {Array} functionDefinitions - Function definitions array
 * @param {Array} cursorCoords - Cursor coordinates array
 * @param {Function} setFunctionDefinitions - Function definitions setter
 * @param {Function} announce - Announcement function
 * @param {Function} showInfoToast - Info toast function
 * @param {Function} openDialog - Dialog opening function
 * @param {Object} [options]
 * @param {boolean} [options.openEditor=true] - Open the edit dialog afterwards. With
 *   false the landmark is created with its default label, shortcut and shape, and an
 *   existing landmark at the position is only reported.
 * @returns {Object} Result object
 */
export function addLandmarkAtCursorPosition(
  functionDefinitions,
  cursorCoords,
  setFunctionDefinitions,
  announce,
  showInfoToast,
  openDialog,
  { openEditor = true } = {}
) {
  // Validate active function and cursor
  const validation = validateActiveFunction(functionDefinitions, cursorCoords);
  if (!validation.valid) {
    announce(validation.message);
    return { success: false, message: validation.message };
  }

  const { activeFunction, activeFunctionIndex, cursorCoord } = validation;
  const x = parseFloat(cursorCoord.x);
  const y = parseFloat(cursorCoord.y);

  // Check for existing landmark at position
  const currentLandmarks = getLandmarksN(functionDefinitions, activeFunctionIndex);
  const existingResult = findLandmarkAtPosition(currentLandmarks, x, y);

  if (existingResult.found) {
    if (!openEditor) {
      const message = `Landmark already exists at x = ${x.toFixed(2)}, y = ${y.toFixed(2)}`;
      announce(message);
      showInfoToast(message, 2000);
      return { success: false, message };
    }

    handleExistingLandmarkFound(
      existingResult.landmark,
      existingResult.index,
      activeFunctionIndex,
      openDialog,
      announce
    );
    return { success: true, message: "Existing landmark opened" };
  }

  // Create new landmark
  const result = addLandmarkWithValidation(functionDefinitions, activeFunctionIndex, x, y);

  if (!result.success) {
    announce(result.message);
    if (result.message.includes("Maximum")) {
      showInfoToast(`Error: ${result.message}`, 3000);
    }
    return result;
  }

  // Update function definitions
  setFunctionDefinitions(result.definitions);

  const updatedLandmarks = getLandmarksN(result.definitions, activeFunctionIndex);
  const newLandmarkIndex = updatedLandmarks.length - 1;
  const newLandmark = updatedLandmarks[newLandmarkIndex];

  // Created with its defaults -- report it instead of opening the editor
  if (!openEditor) {
    const message = `${newLandmark.label} created at x = ${x.toFixed(2)}, y = ${y.toFixed(2)}, shortcut ${result.shortcut}`;
    announce(message);
    showInfoToast(message, 2000);
    return { success: true, message };
  }

  // Open new landmark in edit dialog

  // Create backup of functionDefinitions BEFORE the landmark was added
  const backupBeforeAdd = JSON.parse(JSON.stringify(functionDefinitions));

  setTimeout(() => {
    openDialog("edit-landmark", {
      landmarkData: {
        functionIndex: activeFunctionIndex,
        landmarkIndex: newLandmarkIndex,
        landmark: newLandmark,
        backupFunctionDefinitions: backupBeforeAdd,
        shortcut: result.shortcut
      }
    });
  }, 100);

  return { success: true, message: "Landmark created and dialog opened" };
}

/**
 * Remove the landmark the cursor is standing on
 *
 * Matched by x alone: the cursor always sits on the curve, and its coordinates are
 * rounded to two decimals, so a y comparison would miss on steep sections.
 *
 * @param {Array} functionDefinitions - Function definitions array
 * @param {Array} cursorCoords - Cursor coordinates array
 * @param {Function} setFunctionDefinitions - Function definitions setter
 * @param {Function} announce - Announcement function
 * @param {Function} showInfoToast - Info toast function
 * @returns {Object} Result object
 */
export function removeLandmarkAtCursorPosition(
  functionDefinitions,
  cursorCoords,
  setFunctionDefinitions,
  announce,
  showInfoToast
) {
  const validation = validateActiveFunction(functionDefinitions, cursorCoords);
  if (!validation.valid) {
    announce(validation.message);
    return { success: false, message: validation.message };
  }

  const { activeFunctionIndex, cursorCoord } = validation;
  const x = parseFloat(cursorCoord.x);

  const landmarks = getLandmarksN(functionDefinitions, activeFunctionIndex);
  const landmarkIndex = landmarks.findIndex(landmark => Math.abs(landmark.x - x) < LANDMARK_X_TOLERANCE);

  if (landmarkIndex === -1) {
    const message = `No landmark at x = ${x.toFixed(2)}`;
    announce(message);
    showInfoToast(message, 2000);
    return { success: false, message };
  }

  const label = landmarks[landmarkIndex].label || `Landmark ${landmarkIndex + 1}`;
  const result = removeLandmarkWithValidation(functionDefinitions, activeFunctionIndex, landmarkIndex);

  if (!result.success) {
    announce(result.message);
    showInfoToast(`Error: ${result.message}`, 3000);
    return result;
  }

  setFunctionDefinitions(result.definitions);

  const message = `${label} deleted`;
  announce(message);
  showInfoToast(message, 2000);
  return { success: true, message };
}
