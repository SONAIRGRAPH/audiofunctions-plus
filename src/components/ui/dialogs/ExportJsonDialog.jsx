import React, { useState, useEffect, useRef } from "react";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useGraphContext } from "../../../context/GraphContext";
import { Download, Check } from "lucide-react";

const ExportJsonDialog = ({ isOpen, onClose }) => {
  const { graphBounds, graphSettings, setGraphSettings, functionDefinitions } = useGraphContext();
  const [statusMessage, setStatusMessage] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [inputErrors, setInputErrors] = useState({});

  // Local state for export settings (not saved until export is clicked)
  const [exportSettings, setExportSettings] = useState({
    minBoundDifference: 0.1,
    maxBoundDifference: 100,
    restrictionMode: "none"
  });

  // Check if there are any errors that prevent exporting
  const hasErrors = Object.keys(inputErrors).length > 0;

  // Initialize export settings when dialog opens
  useEffect(() => {
    if (isOpen) {
      setExportSettings({
        minBoundDifference: graphSettings.minBoundDifference || 0.1,
        maxBoundDifference: graphSettings.maxBoundDifference || 100,
        restrictionMode: graphSettings.restrictionMode || "none"
      });
      setShowAdvancedOptions(false);
      setInputErrors({}); // Clear errors when opening dialog
      announceStatus('Export dialog opened.');
    }
  }, [isOpen, graphSettings]);

  // Announce status changes to screen readers
  const announceStatus = (message) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // Validation functions
  const validateBoundDifference = (value, field) => {
    const errors = [];

    // Check if value is empty or just a minus sign
    if (value === '' || value === '-') {
      errors.push("Value cannot be empty");
      return errors;
    }

    // Check if it's a valid number
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      errors.push("Must be a valid number");
      return errors;
    }

    // Check for infinite values
    if (!isFinite(numValue)) {
      errors.push("Value cannot be infinite");
      return errors;
    }

    // Check for positive values
    if (numValue <= 0) {
      errors.push("Value must be greater than 0");
      return errors;
    }

    return errors;
  };

  const validateBoundDifferences = (settings) => {
    const errors = {};

    // Validate individual fields
    ['minBoundDifference', 'maxBoundDifference'].forEach(field => {
      const fieldErrors = validateBoundDifference(settings[field], field);
      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors;
      }
    });

    // If individual validations passed, check relationships
    if (Object.keys(errors).length === 0) {
      const minDiff = parseFloat(settings.minBoundDifference);
      const maxDiff = parseFloat(settings.maxBoundDifference);

      // Check if min is less than max
      if (minDiff >= maxDiff) {
        errors.minBoundDifference = errors.minBoundDifference || [];
        errors.maxBoundDifference = errors.maxBoundDifference || [];
        errors.minBoundDifference.push("Min difference must be less than max difference");
        errors.maxBoundDifference.push("Max difference must be greater than min difference");
      }

      // Check if current view fits within the new bounds
      if (graphBounds) {
        const currentXRange = Math.abs(graphBounds.xMax - graphBounds.xMin);
        const currentYRange = Math.abs(graphBounds.yMax - graphBounds.yMin);

        // Check if current view is too small for new minimum
        if (currentXRange < minDiff || currentYRange < minDiff) {
          errors.minBoundDifference = errors.minBoundDifference || [];
          errors.minBoundDifference.push(`Current view (X: ${currentXRange.toFixed(2)}, Y: ${currentYRange.toFixed(2)}) is smaller than minimum difference`);
        }

        // Check if current view is too large for new maximum
        if (currentXRange > maxDiff || currentYRange > maxDiff) {
          errors.maxBoundDifference = errors.maxBoundDifference || [];
          errors.maxBoundDifference.push(`Current view (X: ${currentXRange.toFixed(2)}, Y: ${currentYRange.toFixed(2)}) is larger than maximum difference`);
        }
      }
    }

    return errors;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape: Close dialog (cancel)
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
      // Ctrl+S or Cmd+S: Download JSON
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleExport();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleCancel = () => {
    onClose();
  };

  const handleExport = () => {
    // Prevent exporting if there are errors
    if (hasErrors) {
      announceStatus("Cannot export: Please fix all errors before exporting.");
      return;
    }

    // Update graph settings with export settings
    setGraphSettings(prevSettings => ({
      ...prevSettings,
      defaultView: [graphBounds.xMin, graphBounds.xMax, graphBounds.yMax, graphBounds.yMin],
      minBoundDifference: exportSettings.minBoundDifference,
      maxBoundDifference: exportSettings.maxBoundDifference
    }));

    // Create export data object
    const exportData = {
      functions: functionDefinitions,
      graphSettings: {
        ...graphSettings,
        defaultView: [graphBounds.xMin, graphBounds.xMax, graphBounds.yMax, graphBounds.yMin],
        minBoundDifference: exportSettings.minBoundDifference,
        maxBoundDifference: exportSettings.maxBoundDifference,
        restrictionMode: exportSettings.restrictionMode
      }
    };

    try {
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'audiofunctions-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      announceStatus('JSON file downloaded successfully.');
      onClose();
    } catch (err) {
      announceStatus('Error downloading JSON file.');
      console.error('Download error:', err);
    }
  };

  const updateExportSetting = (key, value) => {
    setExportSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNumberChange = (field, value) => {
    // Allow empty strings, minus signs and valid numbers during typing
    if (value === '' || value === '-' || !isNaN(parseFloat(value))) {
      const newValue = value === '' || value === '-' ? value : parseFloat(value);
      const newSettings = {
        ...exportSettings,
        [field]: newValue
      };
      setExportSettings(newSettings);

      // Validate in real-time but only show errors after user interaction
      const errors = validateBoundDifferences(newSettings);
      setInputErrors(errors);
    }
  };

  const handleBlur = (field, value) => {
    // On blur, ensure a valid value is set
    let finalValue = value;

    if (value === '' || value === '-') {
      finalValue = field === 'minBoundDifference' ? 0.1 : 100;
      const newSettings = { ...exportSettings, [field]: finalValue };
      setExportSettings(newSettings);
    }

    // Validate after blur to show any errors
    const currentSettings = { ...exportSettings, [field]: finalValue };
    const errors = validateBoundDifferences(currentSettings);
    setInputErrors(errors);

    if (errors[field]) {
      announceStatus(`Error in ${field}: ${errors[field].join('. ')}`);
    }
  };

  const renderBoundInput = (field, label, id) => {
    const hasError = inputErrors[field] && inputErrors[field].length > 0;
    const errorMessage = hasError ? inputErrors[field].join('. ') : null;

    return (
      <div className="w-full">
        <div className={`text-input-outer ${hasError ? 'error-border error-background' : ''}`}>
          <div className="text-input-label">
            {label}:
          </div>
          <input
            id={id}
            type="number"
            step="0.1"
            value={exportSettings[field]}
            onChange={(e) => handleNumberChange(field, e.target.value)}
            onBlur={(e) => handleBlur(field, e.target.value)}
            aria-label={label}
            aria-invalid={hasError ? 'true' : 'false'}
            aria-errormessage={hasError ? `${id}-error` : undefined}
            className={`text-input-inner ${hasError ? 'error-input' : ''}`}
          />
        </div>
        {hasError && (
          <div
            id={`${id}-error`}
            className="error-message mt-1 text-sm"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <span className="error-icon" aria-hidden="true">⚠️</span>
            {errorMessage}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative" aria-modal="true" role="dialog" aria-labelledby="dialog-title" aria-describedby="dialog-description">
      <div className="fixed inset-0 bg-overlay" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <DialogPanel className="w-full max-w-2xl max-h-[90vh] bg-background rounded-lg shadow-lg flex flex-col">
          <div className="p-6 pb-4">
            <DialogTitle id="dialog-title" className="text-lg font-bold text-titles">
              Export JSON
            </DialogTitle>
            <Description id="dialog-description" className="text-descriptions">
              Export the current state including all defined functions with their sonifications, movement adjustment values, the current view, and the active function. Configure additional export settings below.
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

          <div className="flex-1 overflow-y-auto px-6 space-y-6" role="main" aria-label="Export content">
            {/* Restriction Mode */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-titles mb-1">Restriction Mode</h3>
                  <p className="text-sm text-descriptions">
                    Control how users can interact with exported graphs
                  </p>
                </div>
                <div className="text-input-outer pr-1.5 min-w-40">
                  <select
                    id="restriction-mode"
                    value={exportSettings.restrictionMode}
                    onChange={(e) => updateExportSetting('restrictionMode', e.target.value)}
                    className="grow text-input-inner"
                    aria-label="Restriction mode"
                  >
                    <option value="none" className="bg-background text-txt">None</option>
                    <option value="read-only" className="bg-background text-txt">Read Only</option>
                    <option value="full-restriction" className="bg-background text-txt">Full Restriction</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Advanced Options Toggle */}
            <div>
              <div
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center space-x-2 text-base font-semibold text-titles cursor-pointer select-none"
                aria-expanded={showAdvancedOptions}
                aria-controls="advanced-options"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowAdvancedOptions(!showAdvancedOptions);
                  }
                }}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>Advanced options</span>
              </div>

              {/* Collapsible Advanced Options */}
              {showAdvancedOptions && (
                <div
                  id="advanced-options"
                  className="mt-4 animate-in slide-in-from-top-2 duration-300"
                >
                  {/* Zoom Limits */}
                  <div>
                    <h4 className="text-sm font-semibold text-titles mb-3">Zoom limits</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {renderBoundInput('minBoundDifference', 'Min Axis Interval', 'min-bound-diff')}
                      {renderBoundInput('maxBoundDifference', 'Max Axis Interval', 'max-bound-diff')}
                    </div>
                  </div>
                  <br />
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4" role="group" aria-label="Dialog actions">
            <div className="flex justify-end items-center gap-2" role="group" aria-label="Dialog controls">
              <button
                onClick={handleCancel}
                className="btn-secondary sm:w-auto"
              >
                Cancel
              </button>

              <button
                onClick={handleExport}
                className="btn-primary sm:w-auto"
                disabled={hasErrors}
                aria-disabled={hasErrors}
                title={hasErrors ? "Please fix all errors before exporting" : "Export as JSON file"}
                aria-label="Export as JSON file"
              >
                Export
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ExportJsonDialog;
