import React, { useState, useEffect, useRef } from "react";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ChevronLeft, ChevronRight, Check, BookOpen } from "lucide-react";

const WelcomeDialog = ({ isOpen, onClose, isAutoOpened = false }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const contentRef = useRef(null);
  const hasAnnouncedRef = useRef(false);
  const timeoutRef = useRef(null);

  // Tutorial pages content
  const pages = [
    {
      title: "Welcome to AudioFunctions+",
      content: (
        <div className="space-y-4" tabIndex={-1}>
          <p className="text-descriptions">
            Welcome to AudioFunctions+, an innovative tool for exploring mathematical functions through interactive sonification.
          </p>
          <p className="text-descriptions">
            This tutorial will guide you through the main features and help you get started with creating and exploring mathematical functions.
          </p>
          <div className="info-box" role="note" aria-label="Helpful tip">
            <p className="text-descriptions">
              <strong>Tip:</strong> You can always access this tutorial again through the Help section in the command palette (<kbd className="kbd">Ctrl+K</kbd> or <kbd className="kbd">Cmd+K</kbd>) or by pressing <kbd className="kbd">F1</kbd>
            </p>
          </div>

          {/* User Guide link section */}
          <div className="shortcut-reference-box">
            <h2 className="text-titles font-semibold mb-3">Complete Documentation</h2>
            <p className="text-descriptions text-sm mb-4">
              This tutorial provides a quick overview of the main features. For comprehensive documentation including all shortcuts, and advanced features, visit our detailed user guide.
            </p>
            <button
              onClick={() => {
                window.open('https://sonairgraph.github.io/audiofunctions-plus/', '_blank');
              }}
              className="btn-primary flex items-center gap-2 justify-center"
              aria-label="Open complete user guide in new tab"
            >
              <BookOpen className="w-4 h-4" />
              View Complete Guide
            </button>
          </div>
        </div>
      )
    },
    {
      title: "Navigation and Sonification",
      content: (
        <div className="space-y-4" tabIndex={-1}>
          <p className="text-descriptions">
            AudioFunctions+ offers multiple ways to explore your functions with both visual and audio feedback.
          </p>
          <div className="space-y-3">
            <div>
              <h2 className="text-titles font-semibold">Keyboard Navigation:</h2>
              <ul className="list-disc list-inside space-y-1 text-descriptions text-sm" role="list">
                <li><kbd className="kbd">←</kbd> / <kbd className="kbd">→</kbd> or <kbd className="kbd">J</kbd> / <kbd className="kbd">L</kbd> - Move cursor step by step</li>
                <li><kbd className="kbd">Shift</kbd> + (<kbd className="kbd">←</kbd> / <kbd className="kbd">→</kbd> or <kbd className="kbd">J</kbd> / <kbd className="kbd">L</kbd>) - Smooth continuous movement</li>
                <li><kbd className="kbd">W/A/S/D</kbd> - Pan the view</li>
                <li><kbd className="kbd">Z</kbd> - Zoom in</li>
                <li><kbd className="kbd">Shift</kbd> + <kbd className="kbd">Z</kbd> - Zoom out</li>
              </ul>
            </div>
            <div>
              <h2 className="text-titles font-semibold">Audio Features:</h2>
              <p className="text-descriptions">
                As you navigate, you'll hear the function values as musical tones, making it easier to understand the mathematical relationships. You can switch between two different sonification modes by pressing <kbd className="kbd">I</kbd>. Additionally, there are various earcons (audio cues) that provide helpful feedback.
              </p>
              <div className="mt-3">
                <button
                  onClick={() => {
                    window.open('https://sonairgraph.github.io/audiofunctions-plus/earcons.html', '_blank');
                  }}
                  className="btn-secondary flex items-center gap-2"
                  aria-label="Learn more about earcons and audio cues in new tab"
                >
                  <BookOpen className="w-4 h-4" />
                  Learn About Earcons
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Other Actions",
      content: (
        <div className="space-y-4" tabIndex={-1}>
          <p className="text-descriptions">
            Beyond navigating functions, AudioFunctions+ offers many additional features through the <strong>Command Palette</strong>.
          </p>

          <div className="space-y-3">
            <div>
              <h2 className="text-titles font-semibold">Opening the Command Palette:</h2>
              <kbd className="kbd">Ctrl+K</kbd> / <kbd className="kbd">Cmd+K</kbd> - Opens the Command Palette
              <p className="text-descriptions text-sm mt-2">
                The Command Palette is your central hub for all actions like "show current coordinates" or "switch sonification instrument". Many actions also have direct keyboard shortcuts (hotkeys).
              </p>
            </div>

            <div className="info-box" role="note" aria-label="Command Palette tip">
              <p className="text-descriptions">
                <strong>Tip:</strong> In the Command Palette, you can simply type part of a action name (e.g. "instrument", "coordinates") - you don't need to know the exact name!
              </p>
            </div>
          </div>

          {/* Additional Resources section */}
          <div className="shortcut-reference-box">
            <h2 className="text-titles font-semibold mb-3">Additional Resources</h2>

            <p className="text-descriptions text-sm mb-4">
              For comprehensive documentation, visit our detailed program guide which includes a complete list of all keyboard shortcuts and advanced features.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  window.open('https://sonairgraph.github.io/audiofunctions-plus/', '_blank');
                }}
                className="btn-primary flex items-center gap-2 justify-center"
                aria-label="Open detailed program guide in new tab"
              >
                <BookOpen className="w-4 h-4" />
                View Complete Guide
              </button>

              <button
                onClick={() => {
                  window.open('https://sonairgraph.github.io/audiofunctions-plus/shortcuts.html', '_blank');
                }}
                className="btn-secondary flex items-center gap-2 justify-center"
                aria-label="Open keyboard shortcuts reference in new tab"
              >
                <BookOpen className="w-4 h-4" />
                Shortcuts Reference
              </button>
            </div>
          </div>
        </div>
      )
    }
    // {
    //   title: "Creating Functions",
    //   content: (
    //     <div className="space-y-4" tabIndex={-1}>
    //       <p className="text-descriptions">
    //         You can create mathematical functions using the Edit Functions dialog. Access it by pressing <kbd className="kbd">F</kbd> or through the command palette.
    //       </p>
    //       <div className="space-y-2">
    //         <h2 className="text-titles font-semibold">Function Types:</h2>
    //         <ul className="list-disc list-inside space-y-1 text-descriptions" role="list">
    //           <li><strong>Regular Functions:</strong> Standard mathematical expressions like x squared plus 2 times x minus 1</li>
    //           <li><strong>Piecewise Functions:</strong> Functions with different expressions for different conditions</li>
    //         </ul>
    //       </div>
    //       <div className="info-box" role="note" aria-label="Example">
    //         <p className="text-descriptions">
    //           <strong>Example:</strong> Try entering "sin(x)" or "x^2" to see how functions are visualized and sonified.
    //         </p>
    //       </div>
    //     </div>
    //   )
    // }
  ];

  const isLastPage = currentPage === pages.length - 1;
  const isFirstPage = currentPage === 0;

  // Announce status changes to screen readers - simplified
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

  // Simplified effect - only for dialog opening
  useEffect(() => {
    if (isOpen && !hasAnnouncedRef.current) {
      hasAnnouncedRef.current = true;
      setCurrentPage(0);
      setTimeout(() => {
        announceStatus('Welcome tutorial opened. Use arrow keys or buttons to navigate.');
      }, 600);
    } else if (!isOpen) {
      hasAnnouncedRef.current = false;
    }
  }, [isOpen]);

  // Separate effect for page changes only
  useEffect(() => {
    if (isOpen && hasAnnouncedRef.current) {
      // Update the dialog's accessible description
      const dialogDescription = document.getElementById('dialog-description');
      if (dialogDescription) {
        dialogDescription.textContent = `Page ${currentPage + 1} of ${pages.length}`;
      }
    }
  }, [currentPage, isOpen, pages.length]);

  // Focus management for page changes
  useEffect(() => {
    if (isOpen && contentRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        contentRef.current?.focus();
      }, 100);
    }
  }, [currentPage, isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Focus management for page changes
  useEffect(() => {
    if (isOpen && contentRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        contentRef.current?.focus();
      }, 100);
    }
  }, [currentPage, isOpen]);

  const handleClose = () => {
    // Mark as seen in localStorage so it doesn't show again on startup
    try {
      localStorage.setItem('audiofunctions-welcome-seen', 'true');
    } catch (error) {
      console.warn('Unable to save welcome dialog state to localStorage:', error);
      // Dialog will show again on next visit if localStorage is disabled
    }
    onClose();
  };

  const currentPageData = pages[currentPage];

  return (
    <Dialog
      open={isOpen}
      onClose={isAutoOpened ? () => {} : handleClose} // Disable click-outside close if auto-opened
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
              {currentPageData.title}
            </DialogTitle>
            <Description id="dialog-description" className="text-descriptions" aria-live="polite">
              Page {currentPage + 1} of {pages.length}
            </Description>
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
            aria-label={`Tutorial content: ${currentPageData.title}`}
            tabIndex={-1}
          >
            {currentPageData.content}
          </div>

          {/* Navigation and controls */}
          <div className="px-6 py-4 border-t border-border" role="group" aria-label="Tutorial navigation">
            {/* Page indicators */}
            <div className="flex justify-center mb-4" role="tablist" aria-label="Tutorial pages">
              {pages.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full mx-1 transition-colors duration-200 page-indicator ${
                    index === currentPage
                      ? "page-indicator-active"
                      : "page-indicator-inactive"
                  }`}
                  role="tab"
                  aria-hidden={true}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between items-center" role="group" aria-label="Navigation controls">
              <button
                onClick={handlePrevious}
                disabled={isFirstPage}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Go to previous page"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {/* Only show Skip button if not auto-opened */}
              {!isAutoOpened && (
                <button
                  onClick={handleClose}
                  className="btn-secondary"
                  aria-label="Skip tutorial and close"
                >
                  Skip
                </button>
              )}

              <button
                onClick={isLastPage ? handleClose : handleNext}
                className="btn-primary flex items-center gap-2"
                aria-label={isLastPage ? "Finish tutorial" : "Go to next page"}
              >
                {isLastPage ? (
                  <>
                    <Check className="w-4 h-4" />
                    Finish
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default WelcomeDialog;
