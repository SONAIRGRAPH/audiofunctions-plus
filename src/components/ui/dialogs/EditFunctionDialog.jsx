import React, { useState, useEffect, useRef } from "react";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Delete, Music, Wind, Zap, Guitar } from "lucide-react";
import { useGraphContext } from "../../../context/GraphContext";
import { useInstruments } from "../../../context/InstrumentsContext";
import {useInfoToast} from "../../../context/InfoToastContext"
import {
  getFunctionCount,
  getFunctionDefN,
  getFunctionTypeN,
  getFunctionInstrumentN,
  addFunction,
  removeFunctionN,
  updateFunctionN,
  isFunctionActiveN,
  setFunctionInstrumentN
} from "../../../utils/graphObjectOperations";

//import {separatingCommas } from "../../../utils/parse.js";

const EditFunctionDialog = ({ isOpen, onClose }) => {
  const { functionDefinitions, setFunctionDefinitions, graphSettings, focusChart, inputErrors, setInputErrors } = useGraphContext();
  const {showInfoToast} = useInfoToast();
  const functionDefinitionsBackup = useRef(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [focusAfterAction, setFocusAfterAction] = useState(null);

  // Check if dialog should be read-only
  const isReadOnly = graphSettings?.restrictionMode === "read-only";

  // Check if there are any errors that prevent saving
  const hasErrors = Object.keys(inputErrors).length > 0;

  // Generate unique ID for new functions
  const generateUniqueId = () => {
    const existingIds = (functionDefinitions || []).map(f => f.id);
    let counter = 1;
    while (existingIds.includes(`f${counter}`)) {
      counter++;
    }
    return `f${counter}`;
  };

  // Announce status changes to screen readers
  const announceStatus = (message) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const addFunctionContainer = () => {
    if (isReadOnly) return;

    const newFunction = {
      id: generateUniqueId(),
      functionName: `Function ${getFunctionCount(functionDefinitions) + 1}`,
      type: "function",
      functionDef: "",  // String für regular functions
      isActive: true,
      instrument: "clarinet",
      pointOfInterests: [],
      landmarks: []
    };

    // Deactivate all existing functions and add the new active function
    const updatedDefinitions = (functionDefinitions || []).map(func => ({ ...func, isActive: false }));
    setFunctionDefinitions(addFunction(updatedDefinitions, newFunction));

    announceStatus(`New function added. Total functions: ${getFunctionCount(functionDefinitions) + 1}`);
    setFocusAfterAction(`function-${getFunctionCount(functionDefinitions)}`);
  };

  const addPiecewiseFunctionContainer = () => {
    if (isReadOnly) return;

    const newFunction = {
      id: generateUniqueId(),
      functionName: `Function ${getFunctionCount(functionDefinitions) + 1}`,
      type: "piecewise_function",
      functionDef: [["", ""]],  // Array für piecewise functions
      isActive: true,
      instrument: "clarinet",
      pointOfInterests: [],
      landmarks: []
    };

    // Deactivate all existing functions and add the new active function
    const updatedDefinitions = (functionDefinitions || []).map(func => ({ ...func, isActive: false }));
    setFunctionDefinitions(addFunction(updatedDefinitions, newFunction));

    announceStatus(`New piecewise function added. Total functions: ${getFunctionCount(functionDefinitions) + 1}`);
    setFocusAfterAction(`piecewise-function-${getFunctionCount(functionDefinitions)}-part-0-function`);
  };

  const removeContainer = (index) => {
    if (isReadOnly) return; // Prevent action in read-only mode

    const functionType = getFunctionTypeN(functionDefinitions, index) === 'piecewise_function' ? 'piecewise function' : 'function';
    const wasActive = isFunctionActiveN(functionDefinitions, index);

    // Remove the function first
    let updatedDefinitions = removeFunctionN(functionDefinitions, index);

    // If the removed function was active and there are still functions left, activate another one
    if (wasActive && updatedDefinitions.length > 0) {
      // Prefer the function that was before the deleted one, or the first one if we deleted index 0
      const newActiveIndex = index > 0 ? index - 1 : 0;
      // Make sure the index is valid after removal
      const targetIndex = Math.min(newActiveIndex, updatedDefinitions.length - 1);

      updatedDefinitions = updatedDefinitions.map((func, i) => ({
        ...func,
        isActive: i === targetIndex
      }));
    }

    setFunctionDefinitions(updatedDefinitions);

    announceStatus(`${functionType} ${index + 1} deleted. Remaining functions: ${updatedDefinitions.length}`);
  };

  const updateFunctionDef = (index, newFunctionDef) => {
    if (isReadOnly) return;
    setFunctionDefinitions(updateFunctionN(functionDefinitions, index, { functionDef: newFunctionDef }));
  };
  // Focus management
  useEffect(() => {
    if (focusAfterAction) {
      const element = document.getElementById(focusAfterAction);
      if (element) {
        element.focus();
      }
      setFocusAfterAction(null);
    }
  }, [focusAfterAction, functionDefinitions]);
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape: Close dialog (cancel)
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      functionDefinitionsBackup.current = functionDefinitions; // backup current function definitions
      // console.log("Open: ", functionDefinitionsBackup.current);
      if (isReadOnly) {
        announceStatus(`Edit functions dialog opened in read-only mode. ${getFunctionCount(functionDefinitions)} functions available for viewing.`);
      } else {
        announceStatus(`Edit functions dialog opened. ${getFunctionCount(functionDefinitions)} functions available.`);
      }
    }
  }, [isOpen, isReadOnly]);

  const handleCancel = () => {
    // console.log("Cancel: ", functionDefinitionsBackup.current);
    if (functionDefinitionsBackup.current !== null) {
      setFunctionDefinitions(functionDefinitionsBackup.current); // restore old function definitions
    }

    // Clear all input errors when canceling
    setInputErrors({});

    onClose();
    showInfoToast("Changes discarded", 1500)
    setTimeout(() => focusChart(), 100);
  };

  const handleAccept = () => {
    // Prevent saving if there are errors
    if (hasErrors) {
      announceStatus("Cannot save: Please fix all errors before saving.");
      return;
    }

    // Check for modified functions and clear their landmarks
    if (functionDefinitionsBackup.current) {
      const updatedDefinitions = functionDefinitions.map((currentFunc, index) => {
        const backupFunc = functionDefinitionsBackup.current.find(f => f.id === currentFunc.id);

        if (backupFunc) {
          // Helper function to normalize function definition by removing all whitespace
          const normalizeDefinition = (def) => {
            if (typeof def === 'string') {
              return def.replace(/\s/g, '');
            }
            if (Array.isArray(def)) {
              return def.map(([func, condition]) => [
                (func || '').replace(/\s/g, ''),
                (condition || '').replace(/\s/g, '')
              ]);
            }
            return def;
          };

          // Compare normalized function definitions
          const currentFuncNormalized = JSON.stringify(normalizeDefinition(currentFunc.functionDef));
          const backupFuncNormalized = JSON.stringify(normalizeDefinition(backupFunc.functionDef));

          // If function definition changed (ignoring whitespace), clear landmarks
          if (currentFuncNormalized !== backupFuncNormalized) {
            // console.log(`Function ${currentFunc.functionName} (ID: ${currentFunc.id}) was modified - clearing landmarks`);
            return {
              ...currentFunc,
              landmarks: []
            };
          }
        }

        return currentFunc;
      });

      // Update function definitions with cleared landmarks where necessary
      setFunctionDefinitions(updatedDefinitions);
    }

    onClose();
    setTimeout(() => focusChart(), 100);
  };

  const handleClose = () => {
    if (hasErrors) {
      announceStatus("Function definitions have errors. Changes discarded.");
      handleCancel();
      return;
    }

    onClose();
    setTimeout(() => focusChart(), 100);
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative" aria-modal="true" role="dialog" aria-labelledby="dialog-title" aria-describedby="dialog-description">
      <div className="fixed inset-0 bg-overlay" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <DialogPanel className="w-full max-w-lg max-h-[90vh] bg-background rounded-lg shadow-lg flex flex-col">
          <div className="p-6 pb-4">
            <DialogTitle id="dialog-title" className="text-lg font-bold text-titles">
              {isReadOnly ? "View functions" : "Edit functions"}
            </DialogTitle>
            <Description id="dialog-description" className="text-descriptions">
              {isReadOnly ? "View active and inactive functions in read-only mode." : "Edit active and inactive functions. Press Enter to save and close."}
            </Description>
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

          <div className="flex-1 overflow-y-auto px-6" role="main" aria-label="Function list">
            {(functionDefinitions || []).length === 0 && (
              <div className="text-center py-8 text-descriptions">
                {isReadOnly ? "No functions defined." : "No functions defined. Click \"Add function\" or \"Add piecewise function\" to create your first function."}
              </div>
            )}            {(functionDefinitions || []).map((functionDef, index) => (
              getFunctionTypeN(functionDefinitions, index) === 'piecewise_function' ? (
                <PiecewiseFunctionContainer
                  key={functionDef.id}
                  index={index}
                  value={getFunctionDefN(functionDefinitions, index)}
                  instrument={getFunctionInstrumentN(functionDefinitions, index)}
                  onChange={(newValue) => updateFunctionDef(index, newValue)}
                  onDelete={() => removeContainer(index)}
                  onAccept={handleAccept}
                  isReadOnly={isReadOnly}
                />
              ) : (
                <FunctionContainer
                  key={functionDef.id}
                  index={index}
                  value={getFunctionDefN(functionDefinitions, index)}
                  instrument={getFunctionInstrumentN(functionDefinitions, index)}
                  onChange={(newValue) => updateFunctionDef(index, newValue)}
                  onDelete={() => removeContainer(index)}
                  onAccept={handleAccept}
                  isReadOnly={isReadOnly}
                />
              )
            ))}
          </div>

          <div className="px-6 py-4" role="group" aria-label="Dialog actions">
            {!isReadOnly && (
              <div className="flex gap-2 mb-4" role="group" aria-label="Add new functions">
                <button
                  onClick={addFunctionContainer}
                  className="btn-neutral flex-1"
                  aria-label="Add regular function"
                >
                  Add regular function
                </button>
                <button
                  onClick={addPiecewiseFunctionContainer}
                  className="btn-neutral flex-1"
                  aria-label="Add piecewise function"
                >
                  Add piecewise function
                </button>
              </div>
            )}
            <div className="flex justify-end items-center gap-2" role="group" aria-label="Dialog controls">
              <button
                onClick={handleCancel}
                className="btn-secondary sm:w-auto"
              >
                Cancel
              </button>

              <button
                onClick={handleAccept}
                className={`btn-primary sm:w-auto`}
                disabled={hasErrors}
                aria-disabled={hasErrors}
                title={hasErrors ? "Please fix all errors before saving" : "Save changes and close"}
              >
                Accept
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

// Helper function to get instrument icon
const getInstrumentIcon = (instrumentName) => {
  switch (instrumentName) {
    case 'clarinet':
      return <Music className="w-4 h-4 text-icon" aria-hidden="true" />;
    case 'flute':
      return <Wind className="w-4 h-4 text-icon" aria-hidden="true" />;
    case 'organ':
      return <Zap className="w-4 h-4 text-icon" aria-hidden="true" />;
    case 'guitar':
      return <Guitar className="w-4 h-4 text-icon" aria-hidden="true" />;
    default:
      return <Music className="w-4 h-4 text-icon" aria-hidden="true" />;
  }
};

// Simplified helper function to get part-specific errors
const getPartErrors = (inputErrors, functionId) => {
  const errorInfo = inputErrors[functionId];
  if (!errorInfo) return { functionErrors: [], conditionErrors: [] };

  return {
    functionErrors: errorInfo.functionErrors || [],
    conditionErrors: errorInfo.conditionErrors || []
  };
};

// Simplified helper function to get general function errors
const getGeneralError = (inputErrors, functionId) => {
  const errorInfo = inputErrors[functionId];
  return errorInfo?.generalError || null;
};

const FunctionContainer = ({ index, value, instrument, onChange, onDelete, onAccept, isReadOnly }) => {
  const { functionDefinitions, setFunctionDefinitions, inputErrors } = useGraphContext();
  const { availableInstruments } = useInstruments();

  const functionId = functionDefinitions[index]?.id;

  // Get error information for this function (only general errors for regular functions)
  const generalError = getGeneralError(inputErrors, functionId);

  const hasError = functionId && generalError;
  const errorMessage = generalError; // generalError is already the string, not an object

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Call the accept function directly
      if (onAccept) {
        onAccept();
      }
    }
  };

  const handleFocus = () => {
    if (isReadOnly) return; // Prevent focus changes in read-only mode
    // Set this function as active when its input is focused
    const updatedDefinitions = functionDefinitions.map((func, i) => ({
      ...func,
      isActive: i === index
    }));
    setFunctionDefinitions(updatedDefinitions);
  };

  const handleInstrumentChange = (e) => {
    e.stopPropagation(); // Prevent triggering other events

    const currentInstrument = instrument || "clarinet"; // Default to clarinet

    // Only allow switching between clarinet and guitar
    // If current instrument is not clarinet or guitar, default to guitar
    let nextInstrument;
    if (currentInstrument === "clarinet") {
      nextInstrument = "guitar";
    } else {
      // For any other instrument (including guitar), switch to clarinet
      nextInstrument = "clarinet";
    }

    // console.log(`Changing instrument for function ${index + 1} from ${currentInstrument} to ${nextInstrument}`);

    const updatedDefinitions = setFunctionInstrumentN(functionDefinitions, index, nextInstrument);
    setFunctionDefinitions(updatedDefinitions);
  };

  const handleInstrumentKeyDown = (e) => {
    if (isReadOnly) return; // Prevent action in read-only mode

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleInstrumentChange(e);
    }
  };

  return (
    <div
      className={`mb-4 ${isReadOnly ? 'opacity-60' : ''}`}
      role="group"
      aria-labelledby={`function-${index}-label`}
    >
      <label
        id={`function-${index}-label`}
        htmlFor={`function-${index}`}
        className="block text-sm font-medium text-descriptions"
      >
        Function {index + 1}
      </label>

      <div className="mt-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div
              className={`text-input-outer ${hasError ? 'error-border error-input' : ''}`}
              aria-errormessage={hasError ? `function-${index}-error` : undefined}
            >
              <input
                id={`function-${index}`}
                type="text"
                placeholder="e.g., x^2 + 2*x - 1"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                className="text-input-inner flex-1"
                aria-description={isReadOnly ? "Mathematical expression. Read-only mode active." : "Mathematical expression."}
                readOnly={isReadOnly}
                tabIndex={0}
                aria-invalid={hasError ? 'true' : 'false'}
                aria-errormessage={hasError ? `function-${index}-error` : undefined}
              />
            </div>

            {/* Error display for regular functions - moved inside the input container */}
            {hasError && (
              <div
                id={`function-${index}-error`}
                className="error-message mt-1"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
              >
                <span className="error-icon" aria-hidden="true">⚠️</span>
                {errorMessage}
              </div>
            )}
          </div>

          {/* Control buttons - only show in edit mode */}
          {!isReadOnly && (
          <div className="flex gap-2 flex-shrink-0" role="group" aria-label={`Function ${index + 1} actions`}>
              {/* <button
                type="button"
                className="btn-neutral"
                onClick={handleInstrumentChange}
                onKeyDown={handleInstrumentKeyDown}
                aria-label={`Change instrument for function ${index + 1}. Current instrument: ${instrument}. Click to cycle to next instrument.`}
                title={`Change instrument for function ${index + 1}. Current: ${instrument}`}
              >
                {getInstrumentIcon(instrument)}
                <span className="sr-only">{instrument}</span>
              </button> */}
              <button
                type="button"
                className="btn-neutral"
                aria-label={`Delete function ${index + 1}`}
                onClick={onDelete}
              >
                <Delete className="w-4 h-4 text-icon" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PiecewiseFunctionContainer = ({ index, value, instrument, onChange, onDelete, onAccept, isReadOnly }) => {
  const { functionDefinitions, setFunctionDefinitions, inputErrors } = useGraphContext();
  const { availableInstruments } = useInstruments();
  const needsUpdateRef = useRef(false);

  // Get error information for this function
  const functionId = functionDefinitions[index]?.id;
  const { functionErrors, conditionErrors } = getPartErrors(inputErrors, functionId);
  const generalError = getGeneralError(inputErrors, functionId);

  // console.log("=== Piecewise Function Error Debug ===");
  // console.log("Function ID:", functionId);
  // console.log("Function errors:", functionErrors);
  // console.log("Condition errors:", conditionErrors);
  // console.log("General error:", generalError);
  // console.log("=======================================");

  // Parse the piecewise function string or initialize with one empty part
  const [parts, setParts] = useState(() => {
    // Jetzt ist value ein Array statt String
    if (value && Array.isArray(value)) {
      return value.map(([func, condition]) => ({
        function: func || '',
        condition: condition || ''
      }));
    }
    return [{ function: '', condition: '' }];
  });

  // Sync parts with parent value changes
  useEffect(() => {
    if (value && Array.isArray(value)) {
      const newParts = value.map(([func, condition]) => ({
        function: func || '',
        condition: condition || ''
      }));
      setParts(newParts);
    }
  }, [value]);

  // Update parent when parts change
  useEffect(() => {
    if (needsUpdateRef.current) {
      const newValue = parts.map(part => [part.function, part.condition]);
      onChange(newValue);
      needsUpdateRef.current = false;
    }
  }, [parts, onChange]);

  // Event handlers
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (onAccept) {
        onAccept();
      }
    }
  };

  const handleFocus = () => {
    if (isReadOnly) return;
    // Set this function as active when any input is focused
    const updatedDefinitions = functionDefinitions.map((func, i) => ({
      ...func,
      isActive: i === index
    }));
    setFunctionDefinitions(updatedDefinitions);
  };

  const handleInstrumentChange = (e) => {
    if (isReadOnly) return;
    e.stopPropagation();

    const currentInstrument = instrument || "clarinet";

    let nextInstrument;
    if (currentInstrument === "clarinet") {
      nextInstrument = "guitar";
    } else {
      nextInstrument = "clarinet";
    }

    // console.log(`Changing instrument for piecewise function ${index + 1} from ${currentInstrument} to ${nextInstrument}`);

    const updatedDefinitions = setFunctionInstrumentN(functionDefinitions, index, nextInstrument);
    setFunctionDefinitions(updatedDefinitions);
  };

  const handleInstrumentKeyDown = (e) => {
    if (isReadOnly) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleInstrumentChange(e);
    }
  };

  // Part management functions
  const updatePart = (partIndex, field, newValue) => {
    if (isReadOnly) return;

    setParts(prevParts => {
      const newParts = [...prevParts];
      newParts[partIndex] = { ...newParts[partIndex], [field]: newValue };
      needsUpdateRef.current = true;
      return newParts;
    });
  };

  const addPart = () => {
    if (isReadOnly) return;

    setParts(prevParts => {
      const newParts = [...prevParts, { function: '', condition: '' }];
      needsUpdateRef.current = true;
      return newParts;
    });
  };

  const removePart = (partIndex) => {
    if (isReadOnly || parts.length <= 1) return;

    setParts(prevParts => {
      const newParts = prevParts.filter((_, index) => index !== partIndex);
      needsUpdateRef.current = true;
      return newParts;
    });
  };

  // Enhanced part component with specific error highlighting
  const renderPart = (part, partIndex) => {
    const functionHasError = functionErrors[partIndex] && functionErrors[partIndex].length > 0;
    const conditionHasError = conditionErrors[partIndex] && conditionErrors[partIndex].length > 0;

    return (
      <div
        key={partIndex}
        className="mb-4 last:mb-0"
        role="group"
        aria-label={`Part ${partIndex + 1} of ${parts.length}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Function input with error highlighting */}
          <div
            className={`text-input-outer flex-1 min-w-0 ${functionHasError ? 'error-border error-input' : ''}`}
            aria-errormessage={functionHasError ? `piecewise-${index}-part-${partIndex}-function-error` : undefined}
          >
            <input
              id={`piecewise-function-${index}-part-${partIndex}-function`}
              type="text"
              value={part.function}
              onChange={(e) => updatePart(partIndex, 'function', e.target.value)}
              onKeyDown={handleKeyDown}
              className={`text-input-inner w-full grow`}
              placeholder="e.g., x^2 + 1"
              onFocus={handleFocus}
              aria-label={`Function expression for part ${partIndex + 1}`}
              aria-invalid={functionHasError ? 'true' : 'false'}
              aria-describedby={isReadOnly ? "Function expression. Read-only mode active." : "Function expression."}
              aria-errormessage={functionHasError ? `piecewise-${index}-part-${partIndex}-function-error` : undefined}
              readOnly={isReadOnly}
              tabIndex={0}
            />
          </div>

          {/* Condition input with error highlighting */}
          <div
            className={`text-input-outer flex-1 min-w-0 ${conditionHasError ? 'error-border error-input' : ''}`}
            aria-errormessage={conditionHasError ? `piecewise-${index}-part-${partIndex}-condition-error` : undefined}
          >
            <div className="text-input-label" aria-hidden="true">
              if
            </div>
            <input
              id={`piecewise-function-${index}-part-${partIndex}-condition`}
              type="text"
              value={part.condition}
              onChange={(e) => updatePart(partIndex, 'condition', e.target.value)}
              onKeyDown={handleKeyDown}
              className={`text-input-inner w-full grow`}
              placeholder="e.g., x < 0 or x >= 1"
              onFocus={handleFocus}
              aria-label={`Condition for part ${partIndex + 1}${isReadOnly ? ' (read-only)' : ''}`}
              aria-description={isReadOnly ? "Condition when this part applies. Read-only mode active." : "Condition when this part applies."}
              readOnly={isReadOnly}
              tabIndex={0}
              aria-invalid={conditionHasError ? 'true' : 'false'}
              aria-errormessage={conditionHasError ? `piecewise-${index}-part-${partIndex}-condition-error` : undefined}
            />
          </div>

          {/* Remove part button */}
          {!isReadOnly && parts.length > 1 && (
            <button
              type="button"
              className="btn-neutral"
              aria-label={`Remove part ${partIndex + 1} of piecewise function ${index + 1}`}
              onClick={() => removePart(partIndex)}
            >
              <Delete className="w-4 h-4 text-icon" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Part-specific error messages */}
        {functionHasError && (
          <div
            id={`piecewise-${index}-part-${partIndex}-function-error`}
            className="error-message mt-1"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <strong>Function:</strong> {functionErrors[partIndex].join('. ')}
          </div>
        )}

        {conditionHasError && (
          <div
            id={`piecewise-${index}-part-${partIndex}-condition-error`}
            className="error-message mt-1"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <strong>Condition:</strong> {conditionErrors[partIndex].join('. ')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`mb-4 ${isReadOnly ? 'opacity-60' : ''}`}
      role="group"
      aria-labelledby={`piecewise-function-${index}-label`}
      aria-description="Piecewise function with multiple parts."
    >
      <label
        id={`piecewise-function-${index}-label`}
        htmlFor={`piecewise-function-${index}-part-0-function`}
        className="block text-sm font-medium text-descriptions"
      >
        Function {index + 1} (piecewise)
      </label>

      {/* Bordered container for piecewise function parts */}
      <div
        className={`mt-2 border rounded-lg p-4 bg-background ${generalError || functionErrors.some(e => e && e.length > 0) || conditionErrors.some(e => e && e.length > 0) ? 'border-red-500' : 'border-gray-mddk'}`}
        role="group"
        aria-label={`Piecewise function ${index + 1} parts`}
      >
        {parts.map((part, partIndex) => renderPart(part, partIndex))}

        {/* Add part button and control buttons - only show in edit mode */}
        {!isReadOnly && (
          <div
            className="flex gap-2 mt-2 pt-3 items-center"
            role="group"
            aria-label={`Piecewise function ${index + 1} controls`}
          >
            <button
              type="button"
              onClick={addPart}
              className="btn-neutral flex-1"
              aria-description="Add new part"
            >
              Add part
            </button>

            {/* <button
              type="button"
              className="btn-neutral"
              onClick={handleInstrumentChange}
              onKeyDown={handleInstrumentKeyDown}
              aria-label={`Change instrument for piecewise function ${index + 1}. Current instrument: ${instrument}. Click to cycle to next instrument.`}
              title={`Change instrument for piecewise function ${index + 1}. Current: ${instrument}`}
            >
              {getInstrumentIcon(instrument)}
              <span className="sr-only">{instrument}</span>
            </button> */}

            <button
              type="button"
              className="btn-neutral"
              aria-label={`Delete piecewise function ${index + 1}`}
              onClick={onDelete}
            >
              <Delete className="w-4 text-icon" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* General piecewise function error display */}
      {generalError && (
        <div
          className="error-message mt-2"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <span className="error-icon" aria-hidden="true">⚠️</span>
          <strong>General Error:</strong> {generalError}
        </div>
      )}
    </div>
  );
};

export default EditFunctionDialog;
