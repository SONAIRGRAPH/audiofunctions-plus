import React, { useState, useEffect, useRef } from "react";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useGraphContext } from "../../../context/GraphContext";
import ShareLinkDialog from "./ShareLinkDialog";
import { encodeToImportLink } from '../../../utils/urlUtils';

const ShareDialog = ({ isOpen, onClose }) => {
  const { graphBounds, graphSettings, setGraphSettings, functionDefinitions } = useGraphContext();
  const [statusMessage, setStatusMessage] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [inputErrors, setInputErrors] = useState({});

  // Local state for share settings (not saved until share is clicked)
  const [shareSettings, setShareSettings] = useState({
    minBoundDifference: 0.1,
    maxBoundDifference: 100,
    restrictionMode: "none"
  });

  // Check if there are any errors that prevent sharing
  const hasErrors = Object.keys(inputErrors).length > 0;

  // Initialize share settings when dialog opens
  useEffect(() => {
    if (isOpen) {
      setShareSettings({
        minBoundDifference: graphSettings.minBoundDifference || 0.1,
        maxBoundDifference: graphSettings.maxBoundDifference || 100,
        restrictionMode: graphSettings.restrictionMode || "none"
      });
      setShowAdvancedOptions(false);
      setInputErrors({}); // Clear errors when opening dialog
      announceStatus('Share dialog opened.');
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
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleCancel = () => {
    onClose();
  };

  const handleShare = () => {
    // Prevent sharing if there are errors
    if (hasErrors) {
      announceStatus("Cannot share: Please fix all errors before sharing.");
      return;
    }

    // Update graph settings with share settings
    setGraphSettings(prevSettings => ({
      ...prevSettings,
      defaultView: [graphBounds.xMin, graphBounds.xMax, graphBounds.yMax, graphBounds.yMin],
      minBoundDifference: shareSettings.minBoundDifference,
      maxBoundDifference: shareSettings.maxBoundDifference
    }));

    // Create share data object
    const shareData = {
      functions: functionDefinitions,
      graphSettings: {
        ...graphSettings,
        defaultView: [graphBounds.xMin, graphBounds.xMax, graphBounds.yMax, graphBounds.yMin],
        minBoundDifference: shareSettings.minBoundDifference,
        maxBoundDifference: shareSettings.maxBoundDifference,
        restrictionMode: shareSettings.restrictionMode
      }
    };

    // Convert to JSON string and then to base64
    const jsonString = JSON.stringify(shareData);
    const base64String = encodeToImportLink(shareData);

    // Generate the share link
    const baseUrl = window.location.origin + window.location.pathname;
    const shareLink = `${baseUrl}#import=${base64String}`;

    // console.log('Share data (JSON):', jsonString);
    // console.log('Share data (Base64):', base64String);
    // console.log('Share link:', shareLink);

    setGeneratedLink(shareLink);
    setShowLinkDialog(true);
    onClose(); // Close the main share dialog immediately

    announceStatus('Settings saved and share link generated.');
  };

  const handleCloseLinkDialog = () => {
    setShowLinkDialog(false);
    // Don't call onClose() here anymore since share dialog is already closed
  };

  const updateShareSetting = (key, value) => {
    setShareSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNumberChange = (field, value) => {
    // Allow empty strings, minus signs and valid numbers during typing
    if (value === '' || value === '-' || !isNaN(parseFloat(value))) {
      const newValue = value === '' || value === '-' ? value : parseFloat(value);
      const newSettings = {
        ...shareSettings,
        [field]: newValue
      };
      setShareSettings(newSettings);

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
      const newSettings = { ...shareSettings, [field]: finalValue };
      setShareSettings(newSettings);
    }

    // Validate after blur to show any errors
    const currentSettings = { ...shareSettings, [field]: finalValue };
    const errors = validateBoundDifferences(currentSettings);
    setInputErrors(errors);

    if (errors[field]) {
      announceStatus(`Error in ${field}: ${errors[field].join('. ')}`);
    }
  };

  const handleSaveAsFile = () => {
    // Prevent saving if there are errors
    if (hasErrors) {
      announceStatus("Cannot save: Please fix all errors before saving.");
      return;
    }

    // Update graph settings with share settings (defaultView is already set)
    setGraphSettings(prevSettings => ({
      ...prevSettings,
      defaultView: [graphBounds.xMin, graphBounds.xMax, graphBounds.yMax, graphBounds.yMin],
      minBoundDifference: shareSettings.minBoundDifference,
      maxBoundDifference: shareSettings.maxBoundDifference
    }));

    // Create export data object (same as share data)
    const exportData = {
      functions: functionDefinitions,
      graphSettings: {
        ...graphSettings,
        defaultView: [graphBounds.xMin, graphBounds.xMax, graphBounds.yMax, graphBounds.yMin],
        minBoundDifference: shareSettings.minBoundDifference,
        maxBoundDifference: shareSettings.maxBoundDifference,
        restrictionMode: shareSettings.restrictionMode
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

      announceStatus('JSON file downloaded successfully.');
      onClose();
    } catch (err) {
      announceStatus('Error downloading JSON file.');
      console.error('Download error:', err);
    }
  };

  const renderBoundInput = (field, label, id) => {
    const hasError = inputErrors[field] && inputErrors[field].length > 0;
    const errorMessage = hasError ? inputErrors[field].join('. ') : null;

    return (
      <div className="w-full">
        <div className={`text-input-outer ${hasError ? 'error-border error-background' : ''}`}>
          <div className="text-input-label" aria-hidden="true">
            {label}:
          </div>
          <input
            id={id}
            type="number"
            step="0.1"
            value={shareSettings[field]}
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
    <>
      <Dialog open={isOpen} onClose={onClose} className="relative" aria-modal="true" role="dialog" aria-labelledby="dialog-title" aria-describedby="dialog-description">
        <div className="fixed inset-0 bg-overlay" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
          <DialogPanel className="w-full max-w-2xl max-h-[90vh] bg-background rounded-lg shadow-lg flex flex-col">
            <div className="p-6 pb-4">
              <DialogTitle id="dialog-title" className="text-lg font-bold text-titles">
                Share
              </DialogTitle>
              <Description id="dialog-description" className="text-descriptions">
                Share the current state including all defined functions with their sonifications, speed and step-size values, the current view, and the active function.
                Configure additional sharing settings below.
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

            <div className="flex-1 overflow-y-auto px-6 space-y-6" role="main" aria-label="Share content">
              {/* Restriction Mode */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-titles mb-1">Restriction Mode</h3>
                    <p className="text-sm text-descriptions">
                      Control how users can interact with shared graphs
                    </p>
                  </div>
                  <div className="text-input-outer pr-1.5 min-w-40">
                    <select
                      id="restriction-mode"
                      value={shareSettings.restrictionMode}
                      onChange={(e) => updateShareSetting('restrictionMode', e.target.value)}
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
                  onClick={handleSaveAsFile}
                  className="btn-secondary sm:w-auto"
                  disabled={hasErrors}
                  aria-disabled={hasErrors}
                  title={hasErrors ? "Please fix all errors before saving" : "Save as file"}
                >
                  Save as file
                </button>

                <button
                  onClick={handleShare}
                  className="btn-primary sm:w-auto"
                  disabled={hasErrors}
                  aria-disabled={hasErrors}
                  title={hasErrors ? "Please fix all errors before sharing" : "Share via link"}
                >
                  Share via link
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Share Link Dialog */}
      <ShareLinkDialog
        isOpen={showLinkDialog}
        onClose={handleCloseLinkDialog}
        shareLink={generatedLink}
      />
    </>
  );
};

export default ShareDialog;
