/**
 * Step size and playback speed, adjusted in increments that grow with the value.
 *
 * Shared by the movement adjustments dialog and the hotkeys, so the spinner arrows in
 * the dialog and the keyboard move both settings in the same increments.
 */

/** The dialog's minimum for a step size -- a zero would stop the cursor entirely. */
const MIN_STEP_SIZE = 0.01;

/** Same idea for the speed: at zero nothing plays any more. */
const MIN_SPEED = 0.1;

/** How far one press moves the step size at its current value. */
export function stepSizeIncrement(currentValue) {
  const value = parseFloat(currentValue) || 0;
  if (value < 0.1) return 0.01;
  if (value < 1) return 0.05;
  if (value < 5) return 0.1;
  return 1;
}

/** How far one press moves the speed at its current value. */
export function speedIncrement(currentValue) {
  const value = parseFloat(currentValue) || 0;
  if (value < 1) return 0.1;
  if (value < 10) return 0.5;
  return 1;
}

// Increments of 0.1 on binary floats leave trails like 0.30000000000000004, which the
// announcement would read out in full.
const round = (value) => Math.round(value * 100) / 100;

/**
 * @param {number} currentValue
 * @param {1|-1} direction
 * @returns {number} the next step size, never below the minimum
 */
export function nextStepSize(currentValue, direction) {
  const value = parseFloat(currentValue) || 0;
  // Going down uses the increment of the value below, so a press down and a press up
  // land back on the value you started from.
  const increment = direction > 0
    ? stepSizeIncrement(value)
    : stepSizeIncrement(round(value - stepSizeIncrement(value)));

  return Math.max(MIN_STEP_SIZE, round(value + direction * increment));
}

/**
 * @param {number} currentValue
 * @param {1|-1} direction
 * @returns {number} the next speed, never below the minimum
 */
export function nextSpeed(currentValue, direction) {
  const value = parseFloat(currentValue) || 0;
  const increment = direction > 0
    ? speedIncrement(value)
    : speedIncrement(round(value - speedIncrement(value)));

  return Math.max(MIN_SPEED, round(value + direction * increment));
}
