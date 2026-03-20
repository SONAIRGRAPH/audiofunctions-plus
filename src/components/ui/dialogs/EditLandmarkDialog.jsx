import React, { useState, useEffect, useRef } from "react";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useGraphContext } from "../../../context/GraphContext";
import { useAnnouncement } from "../../../context/AnnouncementContext";
import { useInfoToast } from "../../../context/InfoToastContext";
import { updateLandmarkWithValidation, getLandmarksN, validateLandmarkCoordinates, removeLandmarkWithValidation } from "../../../utils/graphObjectOperations";
import { create, all } from 'mathjs';
import { checkMathSpell, transformMathConstants } from "../../../utils/parse";
import landmarkEarconManager from "../../../utils/landmarkEarcons";

const config = {};
const math = create(all, config);

const EditLandmarkDialog = ({ isOpen, onClose, landmarkData = null }) => {
  const { functionDefinitions, setFunctionDefinitions } = useGraphContext();
  const { announce } = useAnnouncement();
  const { showInfoToast } = useInfoToast();

  const [statusMessage, setStatusMessage] = useState('');
  const [inputErrors, setInputErrors] = useState({});
  const landmarkDataBackup = useRef(null);
  const functionDefinitionsBackup = useRef(null); // Add backup for function definitions

  const appearanceChangedRef = useRef(false); // Track if selection changed to prevent double-playing earcon
  const appearanceSelectOpenedRef = useRef(false); // Track if select dropdown was actually opened

  // Local state for landmark data
  const [localLandmark, setLocalLandmark] = useState({
    label: '',
    x: 0,
    y: 0,
    appearance: 'triangle'
  });

  // Check if there are any errors that prevent saving
  const hasErrors = Object.keys(inputErrors).some(key => inputErrors[key] && inputErrors[key].length > 0);

  // Function to calculate Y value from X value and function
  const calculateYFromX = (xValue) => {
    if (!landmarkData || !functionDefinitions) return 0;

    const { functionIndex } = landmarkData;
    const func = functionDefinitions[functionIndex];

    if (!func) return 0;

    try {
      if (func.type === 'function') {
        // Handle regular functions
        const expression = func.functionDef.replace(/\*\*/g, '^');
        const parsed = transformMathConstants(math.parse(expression));
        const compiled = math.compile(parsed.toString());
        return compiled.evaluate({ x: xValue });
      } else if (func.type === 'piecewise_function') {
        // Handle piecewise functions
        const pieces = func.functionDef;

        for (const [expression, condition] of pieces) {
          try {
            // Parse and evaluate condition
            const conditionExpr = condition.replace(/\*\*/g, '^');
            const parsedCondition = transformMathConstants(math.parse(conditionExpr));
            const compiledCondition = math.compile(parsedCondition.toString());
            const conditionResult = compiledCondition.evaluate({ x: xValue });

            if (conditionResult) {
              // Parse and evaluate function expression
              const functionExpr = expression.replace(/\*\*/g, '^');
              const parsedFunction = transformMathConstants(math.parse(functionExpr));
              const compiledFunction = math.compile(parsedFunction.toString());
              return compiledFunction.evaluate({ x: xValue });
            }
          } catch (conditionError) {
            console.warn('Error evaluating piecewise condition:', conditionError);
            continue;
          }
        }

        throw new Error('No matching condition in piecewise function');
      } else {
        throw new Error('Unknown function type');
      }
    } catch (error) {
      console.warn('Could not evaluate function at x =', xValue, error);
      return 0;
    }
  };

  // Initialize landmark earcon manager when dialog opens
  useEffect(() => {
    if (isOpen) {
      const initializeEarconManager = async () => {
        try {
          await landmarkEarconManager.initialize();
        } catch (error) {
          console.warn("Failed to initialize landmark earcon manager:", error);
        }
      };
      initializeEarconManager();
    }
  }, [isOpen]);

  // Initialize landmark data when dialog opens
  useEffect(() => {
    if (isOpen && landmarkData) {
      const { functionIndex, landmarkIndex, landmark, backupFunctionDefinitions } = landmarkData;

      // For new landmarks, use provided backup; for existing landmarks, create our own backup
      if (backupFunctionDefinitions) {
        functionDefinitionsBackup.current = backupFunctionDefinitions;
      } else {
        functionDefinitionsBackup.current = JSON.parse(JSON.stringify(functionDefinitions));
      }

      // Create backup of the landmark data
      landmarkDataBackup.current = {
        functionIndex,
        landmarkIndex,
        landmark: { ...landmark }
      };



      setLocalLandmark({
        label: landmark.label || '',
        x: landmark.x,
        y: landmark.y,
        appearance: landmark.shape || 'triangle'
      });

      setInputErrors({});
      announceStatus(`Edit landmark dialog opened. Current position: x=${landmark.x.toFixed(2)}, y=${landmark.y.toFixed(2)}.`);
    }
  }, [isOpen, landmarkData, functionDefinitions]);

  // Announce status changes to screen readers
  const announceStatus = (message) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // Validation functions
  const validateXCoordinate = (value) => {
    const errors = [];

    // Allow empty string and minus sign during typing
    if (value === '' || value === '-') {
      return errors; // No errors for temporary input states
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      errors.push("X coordinate must be a valid number");
      return errors;
    }

    const validation = validateLandmarkCoordinates(numValue, 0);
    if (!validation.valid) {
      errors.push(validation.message);
    }

    return errors;
  };

  const validateLabel = (value) => {
    const errors = [];

    if (value && value.length > 100) {
      errors.push("Label cannot be longer than 100 characters");
    }

    return errors;
  };

  // Handle input changes
  const handleXChange = (value) => {
    // Always update the display value
    setLocalLandmark(prev => {
      let newX = value;
      let newY = prev.y; // Keep previous Y value during typing

      // Only calculate new Y if we have a valid number
      if (value !== '' && value !== '-' && !isNaN(parseFloat(value))) {
        newX = parseFloat(value);
        newY = calculateYFromX(newX);
      }

      return {
        ...prev,
        x: newX,
        y: newY
      };
    });

    // Validate X coordinate
    const xErrors = validateXCoordinate(value);
    setInputErrors(prev => ({
      ...prev,
      x: xErrors.length > 0 ? xErrors : undefined
    }));
  };

  const handleXBlur = (value) => {
    let finalValue = value;

    // Convert empty or invalid values to 0
    if (value === '' || value === '-' || isNaN(parseFloat(value))) {
      finalValue = '0';
    }

    const numValue = parseFloat(finalValue);
    const newY = calculateYFromX(numValue);

    setLocalLandmark(prev => ({
      ...prev,
      x: numValue,
      y: newY
    }));

    // Validate the final value
    const xErrors = validateXCoordinate(finalValue);
    setInputErrors(prev => ({
      ...prev,
      x: xErrors.length > 0 ? xErrors : undefined
    }));
  };

  const handleLabelChange = (value) => {
    setLocalLandmark(prev => ({
      ...prev,
      label: value
    }));

    const labelErrors = validateLabel(value);
    setInputErrors(prev => ({
      ...prev,
      label: labelErrors.length > 0 ? labelErrors : undefined
    }));
  };

  const handleAppearanceChange = (value) => {
    setLocalLandmark(prev => ({
      ...prev,
      appearance: value
    }));

    // Automatically set earcon based on shape
    const earcon = `landmark_${value}`;
    // console.log(`Landmark shape changed to ${value}, earcon set to ${earcon}`);

    // Mark that selection changed so blur handler knows not to play again
    appearanceChangedRef.current = true;

    // Play earcon preview when shape is selected
    try {
      landmarkEarconManager.playEarcon(value);
    } catch (error) {
      console.warn("Failed to play landmark earcon preview:", error);
    }
  };

  // Play earcon when select gets keyboard focus
  const handleAppearanceFocus = () => {
    try {
      landmarkEarconManager.playEarcon(localLandmark.appearance);
    } catch (error) {
      console.warn("Failed to play landmark earcon preview on focus:", error);
    }
  };

  // Track when dropdown actually opens (mouse click or keyboard open)
  const handleAppearanceMouseDown = () => {
    appearanceSelectOpenedRef.current = true;
  };

  // Track when dropdown opens via keyboard (Space, Enter, ArrowDown, ArrowUp)
  const handleAppearanceKeyDown = (e) => {
    // These keys open the dropdown when the select is focused
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      appearanceSelectOpenedRef.current = true;
    }
  };

  // Play earcon when select dropdown collapses (loses focus)
  const handleAppearanceBlur = () => {
    // Only play earcon if:
    // 1. The select was actually opened (not just tabbed through)
    // 2. Selection didn't change (to avoid double-playing)
    if (appearanceSelectOpenedRef.current && !appearanceChangedRef.current) {
      try {
        landmarkEarconManager.playEarcon(localLandmark.appearance);
      } catch (error) {
        console.warn("Failed to play landmark earcon preview on blur:", error);
      }
    }

    // Reset the flags for next interaction
    appearanceChangedRef.current = false;
    appearanceSelectOpenedRef.current = false;
  };


  // Dialog actions
  const handleAccept = () => {
    if (hasErrors || !landmarkData) return;

    const { functionIndex, landmarkIndex } = landmarkData;

    const updates = {
      label: localLandmark.label,
      x: localLandmark.x,
      y: localLandmark.y,
      shape: localLandmark.appearance,
      earcon: `landmark_${localLandmark.appearance}`
    };

    const result = updateLandmarkWithValidation(functionDefinitions, functionIndex, landmarkIndex, updates);

    if (!result.success) {
      announceStatus(`Error: ${result.message}`);
      setInputErrors({ general: [result.message] });
      return;
    }

    // Update function definitions with the validated changes
    setFunctionDefinitions(result.definitions);

    // Show appropriate success message and toast
    if (landmarkData?.backupFunctionDefinitions) {
      // This is a new landmark being saved
      const shortcutText = landmarkData.shortcut ? ` (Ctrl+${landmarkData.shortcut})` : '';
      announceStatus(`New landmark created successfully.${shortcutText}`);
      showInfoToast(`Landmark added${shortcutText}`, 2000);
    } else {
      // This is an existing landmark being updated
      announceStatus(`Landmark updated successfully.`);
    }

    // Clear backups since changes are accepted
    landmarkDataBackup.current = null;
    functionDefinitionsBackup.current = null;

    onClose();
  };

  const handleDelete = () => {
    if (!landmarkData) return;

    const { functionIndex, landmarkIndex, landmark } = landmarkData;

    // Show confirmation
    const landmarkName = landmark.label || `Landmark at x=${landmark.x.toFixed(2)}`;
    const confirmed = window.confirm(`Are you sure you want to delete "${landmarkName}"? This action cannot be undone.`);

    if (!confirmed) {
      announceStatus('Delete cancelled.');
      return;
    }

    const result = removeLandmarkWithValidation(functionDefinitions, functionIndex, landmarkIndex);

    if (!result.success) {
      announceStatus(`Error: ${result.message}`);
      setInputErrors({ general: [result.message] });
      return;
    }

    // Update function definitions with the landmark removed
    setFunctionDefinitions(result.definitions);
    announceStatus(`Landmark "${landmarkName}" deleted successfully.`);

    // Clear backups since changes are accepted
    landmarkDataBackup.current = null;
    functionDefinitionsBackup.current = null;

    onClose();
  };

  const handleCancel = () => {
    // Handle cancellation based on whether this is a new or existing landmark
    if (functionDefinitionsBackup.current !== null) {
      if (landmarkData?.backupFunctionDefinitions) {
        // For new landmarks, restore backup (which removes the new landmark)
        setFunctionDefinitions(functionDefinitionsBackup.current);
        announceStatus('New landmark cancelled and removed.');
      } else {
        // For existing landmarks, restore backup (which reverts changes)
        setFunctionDefinitions(functionDefinitionsBackup.current);
        announceStatus('Changes cancelled and reverted.');
      }
    } else {
      announceStatus('Changes cancelled.');
    }

    // Clear backups and errors
    landmarkDataBackup.current = null;
    functionDefinitionsBackup.current = null;
    setInputErrors({});

    onClose();
  };

  const handleClose = () => {
    // Only prevent closing if we have validation errors AND we're not explicitly cancelling
    // This method is called by the dialog's onClose prop (clicking overlay, etc.)
    if (hasErrors) {
      announceStatus("Cannot close: Please fix all errors or cancel to discard changes.");
      return;
    }

    // For overlay clicks, treat as cancel
    handleCancel();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCancel(); // Use handleCancel for Escape key
      } else if (e.key === 'Delete') {
        // Delete key shortcut for deleting landmark
        e.preventDefault();
        e.stopPropagation();
        handleDelete();
      } else if (e.key === 'Enter' && !hasErrors) {
        // Check if Delete button is focused
        const activeElement = document.activeElement;
        if (activeElement && activeElement.textContent === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          handleDelete();
          return;
        }

        // Check if Cancel button is focused
        if (activeElement && activeElement.textContent === 'Cancel') {
          e.preventDefault();
          e.stopPropagation();
          handleCancel();
          return;
        }

        // Check if Accept button is focused
        if (activeElement && activeElement.textContent === 'Accept') {
          e.preventDefault();
          e.stopPropagation();
          handleAccept();
          return;
        }

        // For input fields, accept the changes
        e.preventDefault();
        e.stopPropagation();
        handleAccept();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, hasErrors, localLandmark, landmarkData]);

  if (!landmarkData) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="relative"
      aria-modal="true"
      role="dialog"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      <div className="fixed inset-0 bg-overlay" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <DialogPanel className="w-full max-w-lg bg-background rounded-lg shadow-lg flex flex-col max-h-[90vh]">
          <div className="p-6 pb-4 flex-shrink-0">
            <DialogTitle id="dialog-title" className="text-lg font-bold text-titles">
              Edit Landmark
            </DialogTitle>
            <Description id="dialog-description" className="text-descriptions">
              Edit landmark properties. The Y coordinate is automatically calculated based on the X coordinate and function.
            </Description>
            
            {/* Shortcut display */}
            {(landmarkData?.shortcut || landmarkData?.landmark?.shortcut) && (
              <div className="mt-2 text-sm text-txt-subtitle">
                Shortcut: Ctrl+{landmarkData?.shortcut || landmarkData?.landmark?.shortcut}
              </div>
            )}
          </div>

          {/* Live region for status announcements */}
          <div
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
            role="status"
          >
            {statusMessage}
          </div>

          <div className="flex-1 overflow-y-auto px-6 space-y-4 min-h-0" role="main" aria-label="Landmark properties">

            {/* General error display */}
            {inputErrors.general && (
              <div
                className="error-message"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
              >
                <span className="error-icon" aria-hidden="true">⚠️</span>
                {inputErrors.general[0]}
              </div>
            )}

            {/* Label Input */}
            <div className="pt-2">
              <div
                className={`text-input-outer ${inputErrors.label ? 'error-border error-input' : ''}`}
                aria-errormessage={inputErrors.label ? "label-error" : undefined}
              >
                <div className="text-input-label">
                  Label:
                </div>
                <input
                  id="landmark-label"
                  type="text"
                  value={localLandmark.label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  className="text-input-inner grow"
                  placeholder="Optional landmark label"
                  aria-label="Landmark label"
                  aria-invalid={inputErrors.label ? 'true' : 'false'}
                  aria-errormessage={inputErrors.label ? "label-error" : undefined}
                  aria-description="Optional label for the landmark"
                />
              </div>
              {inputErrors.label && (
                <div
                  id="label-error"
                  className="error-message mt-1"
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  <span className="error-icon" aria-hidden="true">⚠️</span>
                  {inputErrors.label[0]}
                </div>
              )}
            </div>

            {/* Coordinates Row - X and Y side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* X Coordinate Input */}
              <div>
                <div
                  className={`text-input-outer ${inputErrors.x ? 'error-border error-input' : ''}`}
                  aria-errormessage={inputErrors.x ? "x-coordinate-error" : undefined}
                >
                  <div className="text-input-label">
                    X:
                  </div>
                  <input
                    id="landmark-x"
                    type="number"
                    step="any"
                    value={localLandmark.x}
                    onChange={(e) => handleXChange(e.target.value)}
                    onBlur={(e) => handleXBlur(e.target.value)}
                    className="text-input-inner"
                    aria-label="X coordinate"
                    aria-invalid={inputErrors.x ? 'true' : 'false'}
                    aria-errormessage={inputErrors.x ? "x-coordinate-error" : undefined}
                    aria-description="X coordinate on the function"
                  />
                </div>
                {inputErrors.x && (
                  <div
                    id="x-coordinate-error"
                    className="error-message mt-1"
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                  >
                    <span className="error-icon" aria-hidden="true">⚠️</span>
                    {inputErrors.x[0]}
                  </div>
                )}
              </div>

              {/* Y Coordinate Display (Read-only) */}
              <div>
                <div className="text-input-outer opacity-60">
                  <div className="text-input-label">
                    Y:
                  </div>
                  <input
                    id="landmark-y"
                    type="text"
                    value={typeof localLandmark.y === 'number' ? localLandmark.y.toFixed(6) : localLandmark.y}
                    className="grow text-input-inner"
                    aria-label="Y coordinate (automatically calculated)"
                    readOnly
                    tabIndex={-1}
                    aria-description="Y coordinate, automatically calculated from X coordinate and function value"
                  />
                </div>
                <div className="text-xs text-descriptions mt-1">
                  Auto-calculated
                </div>
              </div>
            </div>

            {/* Appearance Dropdown */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-titles mb-1">Appearance</h3>
                  <p className="text-xs text-descriptions">
                    Choose how the landmark appears on the graph. Try different appearances to have a preview of how they sound.
                  </p>
                </div>
                <div className="text-input-outer pr-1.5 min-w-32">
                  <select
                    id="landmark-appearance"
                    value={localLandmark.appearance}
                    onChange={(e) => handleAppearanceChange(e.target.value)}
                    onFocus={handleAppearanceFocus}
                    onMouseDown={handleAppearanceMouseDown}
                    onKeyDown={handleAppearanceKeyDown}
                    onBlur={handleAppearanceBlur}
                    className="grow text-input-inner"
                    aria-label="Landmark appearance"
                    aria-description="Visual and auditive appearance of the landmark"
                  >
                    <option value="triangle" className="bg-background text-txt">Triangle</option>
                    <option value="square" className="bg-background text-txt">Square</option>
                    <option value="diamond" className="bg-background text-txt">Diamond</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Dialog Actions */}
          <div className="px-6 py-4 flex-shrink-0" role="group" aria-label="Dialog actions">
            <div className="flex justify-between items-center" role="group" aria-label="Dialog controls">
              {/* Delete button on the left */}
              <div>
                <button
                  onClick={handleDelete}
                  className="btn-danger"
                  title="Delete this landmark permanently"
                  aria-description="Delete this landmark. This action cannot be undone."
                >
                  Delete
                </button>
              </div>

              {/* Cancel and Accept buttons on the right */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAccept}
                  className="btn-primary"
                  disabled={hasErrors}
                  aria-disabled={hasErrors}
                  title={hasErrors ? "Please fix all errors before saving" : "Save changes and close"}
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default EditLandmarkDialog;
