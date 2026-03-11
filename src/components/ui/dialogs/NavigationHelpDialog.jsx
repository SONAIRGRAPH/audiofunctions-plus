import React, { useEffect, useRef } from "react";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { BookOpen } from "lucide-react";

const NavigationHelpDialog = ({ isOpen, onClose }) => {
  const [statusMessage, setStatusMessage] = React.useState('');
  const contentRef = useRef(null);
  const hasAnnouncedRef = useRef(false);
  const timeoutRef = useRef(null);

  // Announce status changes to screen readers
  const announceStatus = (message) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setStatusMessage(message);
    timeoutRef.current = setTimeout(() => {
      setStatusMessage('');
      timeoutRef.current = null;
    }, 3000);
  };

  // Effect for dialog opening
  useEffect(() => {
    if (isOpen && !hasAnnouncedRef.current) {
      hasAnnouncedRef.current = true;
      setTimeout(() => {
        announceStatus('Navigation help dialog opened.');
      }, 600);
    } else if (!isOpen) {
      hasAnnouncedRef.current = false;
    }
  }, [isOpen]);

  // Focus management for content
  useEffect(() => {
    if (isOpen && contentRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        contentRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    onClose();
  };

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
        <DialogPanel className="w-full max-w-2xl max-h-[90vh] bg-background border border-border rounded-lg shadow-lg flex flex-col">
          <div className="p-6 pb-4">
            <DialogTitle id="dialog-title" className="text-lg font-bold text-titles" aria-live="off">
              Navigation Shortcuts
            </DialogTitle>

          </div>

          {/* Status announcements only when needed */}
          {statusMessage && (
            <div
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
              role="status"
            >
              {statusMessage}
            </div>
          )}

          {/* Content area */}
          <div
            ref={contentRef}
            className="pb-4 flex-1 overflow-y-auto px-6 focus:outline-none"
            role="main"
            aria-label="Navigation shortcuts content"
            tabIndex={-1}
          >
            <div className="space-y-6">
              {/* Cursor Movement */}
              <div>
                <h2 className="text-titles font-semibold mb-3">Cursor Movement</h2>
                <ul className="list-disc list-inside space-y-2 text-descriptions text-sm" role="list">
                  <li>Play function (batch sonification): <kbd className="kbd">Space</kbd> / <kbd className="kbd">B</kbd></li>
                  <li>Stepwise cursor navigation: <kbd className="kbd">←</kbd> / <kbd className="kbd">→</kbd> or <kbd className="kbd">J</kbd> / <kbd className="kbd">L</kbd></li>
                  <li>Smooth cursor navigation: (hold) <kbd className="kbd">Shift</kbd> + (<kbd className="kbd">←</kbd> / <kbd className="kbd">→</kbd> or <kbd className="kbd">J</kbd> / <kbd className="kbd">L</kbd>)</li>
                  <li>Mouse cursor navigation: <kbd className="kbd">Use Mouse</kbd> - loudness indicates y-distance between the mousecursor postion and the functiongraph</li>
                </ul>
              </div>

              {/* View Control */}
              <div>
                <h2 className="text-titles font-semibold mb-3">View Control</h2>
                <ul className="list-disc list-inside space-y-2 text-descriptions text-sm" role="list">
                  <li>Pan View: <kbd className="kbd">W</kbd> / <kbd className="kbd">A</kbd> / <kbd className="kbd">S</kbd> / <kbd className="kbd">D</kbd></li>
                  <li>Zoom in: <kbd className="kbd">Z</kbd></li>
                  <li>Zoom out: <kbd className="kbd">Shift</kbd> + <kbd className="kbd">Z</kbd></li>
                </ul>
              </div>


            </div>
          </div>

          {/* Navigation and controls */}
          <div className="px-6 py-4 border-t border-border" role="group" aria-label="Dialog actions">
            {/* Action buttons */}
            <div className="flex justify-end items-center gap-3" role="group" aria-label="Dialog buttons">
              <button
                onClick={() => {
                  window.open('https://sonairgraph.github.io/audiofunctions-plus/', '_blank');
                }}
                className="btn-secondary flex items-center gap-2"
                aria-label="View Complete Guide in new tab"
              >
                <BookOpen className="w-4 h-4" />
                View Complete Guide
              </button>

              <button
                onClick={handleClose}
                className="btn-primary"
                aria-label="Close navigation help dialog"
              >
                Close
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default NavigationHelpDialog;
