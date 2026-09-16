import React, { useState, useEffect, useRef } from "react";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ChevronLeft, ChevronRight, Check, BookOpen } from "lucide-react";
import { LanguageSelector, useLanguage } from "../MultiLanguage";

const WelcomeDialog = ({ isOpen, onClose, isAutoOpened = false }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const contentRef = useRef(null);
  const hasAnnouncedRef = useRef(false);
  const timeoutRef = useRef(null);
  const { trn } = useLanguage();

  // Tutorial pages content
  const pages = [
    {
      title: trn("dlgWelcomeTitle"),
      content: (
        <div className="space-y-4" tabIndex={-1}>
          <p className="text-descriptions">
            {trn("dlgWelcomeLine1")}
          </p>
          <p className="text-descriptions">
            {trn("dlgWelcomeLine2")}
          </p>
          <div className="info-box" role="note" aria-label={trn("dlgWelcomeTipLabel")}>
            <p className="text-descriptions">
              <strong>{trn("dlgWelcomeTip")}</strong> {trn("dlgWelcomeLine3", {kbdCtrlK: <kbd className="kbd">Ctrl+K</kbd>, kbdCmdK: <kbd className="kbd">Cmd+K</kbd>, kbdF1: <kbd className="kbd">F1</kbd>})}
            </p>
          </div>

          {/* User Guide link section */}
          <div className="shortcut-reference-box">
            <h2 className="text-titles font-semibold mb-3">{trn("dlgWelcomeCompleteDoc")}</h2>
            <p className="text-descriptions text-sm mb-4">
              {trn("dlgWelcomeLine4")}
            </p>
            <button
              onClick={() => {
                window.open('https://sonairgraph.github.io/audiofunctions-plus/', '_blank');
              }}
              className="btn-primary flex items-center gap-2 justify-center"
              aria-label={trn("dlgWelcomeViewGuideLabel")}
            >
              <BookOpen className="w-4 h-4" />
              {trn("dlgWelcomeViewGuide")}
            </button>
          </div>
        </div>
      )
    },
    {
      title: trn("dlgWelcomeTitle2"),
      content: (
        <div className="space-y-4" tabIndex={-1}>
          <p className="text-descriptions">
            {trn("dlgWelcomeLine5")}
          </p>
          <div className="space-y-3">
            <div>
              <h2 className="text-titles font-semibold">{trn("dlgWelcomeKeyboardNav")}:</h2>
              <ul className="list-disc list-inside space-y-1 text-descriptions text-sm" role="list">
                <li><kbd className="kbd">←</kbd> / <kbd className="kbd">→</kbd> {trn("or")} <kbd className="kbd">J</kbd> / <kbd className="kbd">L</kbd> - {trn("dlgWelcomeMoveCursor")}</li>
                <li><kbd className="kbd">Shift</kbd> + (<kbd className="kbd">←</kbd> / <kbd className="kbd">→</kbd> {trn("or")} <kbd className="kbd">J</kbd> / <kbd className="kbd">L</kbd>) - {trn("dlgWelcomeSmoothMovement")}</li>
                <li><kbd className="kbd">W/A/S/D</kbd> - {trn("dlgWelcomePanView")}</li>
                <li><kbd className="kbd">Z</kbd> - {trn("dlgWelcomeZoomIn")}</li>
                <li><kbd className="kbd">Shift</kbd> + <kbd className="kbd">Z</kbd> - {trn("dlgWelcomeZoomOut")}</li>
              </ul>
            </div>
            <div>
              <h2 className="text-titles font-semibold">{trn("dlgWelcomeAudioFeatures")}:</h2>
              <p className="text-descriptions">
                {trn("dlgWelcomeLine6", {kbdI: <kbd className="kbd">I</kbd>})}
              </p>
              <div className="mt-3">
                <button
                  onClick={() => {
                    window.open('https://sonairgraph.github.io/audiofunctions-plus/earcons.html', '_blank');
                  }}
                  className="btn-secondary flex items-center gap-2"
                  aria-label={trn("dlgWelcomeEarconsLabel")}
                >
                  <BookOpen className="w-4 h-4" />
                  {trn("dlgWelcomeEarcons")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: trn("dlgWelcomeTitle3"),
      content: (
        <div className="space-y-4" tabIndex={-1}>
          <p className="text-descriptions">
            {trn("dlgWelcomeLine7")} <strong>{trn("dlgWelcomeCommandPalette")}</strong>
          </p>

          <div className="space-y-3">
            <div>
              <h2 className="text-titles font-semibold">Opening the Command Palette:</h2>
              <kbd className="kbd">Ctrl+K</kbd> / <kbd className="kbd">Cmd+K</kbd> - {trn("dlgWelcomeOpenCommandPalette")}
              <p className="text-descriptions text-sm mt-2">
                {trn("dlgWelcomeLine8")}
              </p>
            </div>

            <div className="info-box" role="note" aria-label={trn("dlgWelcomeCommandPaletteTipLabel")}>
              <p className="text-descriptions">
                <strong>{trn("dlgWelcomeTip")}</strong> {trn("dlgWelcomeLine9")}
              </p>
            </div>
          </div>

          {/* Additional Resources section */}
          <div className="shortcut-reference-box">
            <h2 className="text-titles font-semibold mb-3">{trn("dlgWelcomeAdditional")}</h2>

            <p className="text-descriptions text-sm mb-4">
              {trn("dlgWelcomeLine10")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  window.open('https://sonairgraph.github.io/audiofunctions-plus/', '_blank');
                }}
                className="btn-primary flex items-center gap-2 justify-center"
                aria-label={trn("dlgWelcomeViewGuideLabel")}
              >
                <BookOpen className="w-4 h-4" />
                {trn("dlgWelcomeViewGuide")}
              </button>

              <button
                onClick={() => {
                  window.open('https://sonairgraph.github.io/audiofunctions-plus/shortcuts.html', '_blank');
                }}
                className="btn-secondary flex items-center gap-2 justify-center"
                aria-label={trn("dlgWelcomeShortcutsLabel")}
              >
                <BookOpen className="w-4 h-4" />
                {trn("dlgWelcomeShortcuts")}
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
        dialogDescription.textContent = `${trn("Page")} ${currentPage + 1} ${trn("of")} ${pages.length}`;
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
              {trn("Page")} {currentPage + 1} {trn("of")} {pages.length}
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
            <div className="flex justify-between items-center" role="group" aria-label={trn("dlgWelcomeNavigationControlsLabel")}>
              <button
                onClick={handlePrevious}
                disabled={isFirstPage}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={trn("PreviousLabel")}
              >
                <ChevronLeft className="w-4 h-4" />
                {trn("Previous")}
              </button>

              {/* Only show Skip button if not auto-opened */}
              {!isAutoOpened && (
                <button
                  onClick={handleClose}
                  className="btn-secondary"
                  aria-label={trn("dlgWelcomeSkipLabel")}
                >
                  {trn("Skip")}
                </button>
              )}

              <button
                onClick={isLastPage ? handleClose : handleNext}
                className="btn-primary flex items-center gap-2"
                aria-label={isLastPage ? trn("dlgWelcomeFinishLabel") : trn("NextLabel")}
              >
                {isLastPage ? (
                  <>
                    <Check className="w-4 h-4" />
                    {trn("Finish")}
                  </>
                ) : (
                  <>
                    {trn("Next")}
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
