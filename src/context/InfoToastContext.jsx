import React, { createContext, useContext, useState } from 'react';
import InfoToast from '../components/ui/dialogs/InfoToast';
import { toastPositionPref } from '../utils/prefs';

const InfoToastContext = createContext();

export const useInfoToast = () => {
  const context = useContext(InfoToastContext);
  if (!context) {
    throw new Error('useInfoToast must be used within an InfoToastProvider');
  }
  return context;
};

export const InfoToastProvider = ({ children }) => {
  const [message, setMessage] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [timeout, setToastTimeout] = useState(10000);
  const [position, setPosition] = useState(toastPositionPref.get()); // "cursor" or "corner"
  const [dismissOnGraphInteraction, setDismissOnGraphInteraction] = useState(false);
  const [perCursor, setPerCursor] = useState(null);
  // Increments with every call, so the toast can tell a new toast from a re-render
  const [showId, setShowId] = useState(0);

  /**
   * @param {string} message
   * @param {number} [timeout=10000] auto-hide delay in ms
   * @param {object} [options]
   * @param {'cursor'|'corner'} [options.position] defaults to the user preference
   * @param {boolean} [options.dismissOnGraphInteraction=false] hide the toast as soon
   *        as the cursor moves or the view changes. For toasts showing a snapshot of
   *        values (coordinates, bounds) that would otherwise go stale.
   * @param {Object<string, string>} [options.perCursor] one text per function id.
   *        In cursor mode each text appears at its own function's cursor; texts
   *        whose cursor is not visible go to the corner. `message` stays the
   *        combined text, used in corner mode.
   */
  const showInfoToast = (message, timeout = 10000, options = {}) => {
    setMessage(message);
    setToastTimeout(timeout);
    setPosition(options.position ?? toastPositionPref.get());
    setDismissOnGraphInteraction(Boolean(options.dismissOnGraphInteraction));
    setPerCursor(options.perCursor ?? null);
    setShowId((id) => id + 1);
    setIsVisible(true);
  };

  // The toast finds the cursor itself now, the screen position argument is ignored.
  const showLandmarkToast = (message, _screenPosition, timeout = 2000) => {
    showInfoToast(message, timeout, { position: "cursor" });
  };

  const hideInfoToast = () => {
    setIsVisible(false);
  };

  return (
    <InfoToastContext.Provider value={{
      showInfoToast,
      showLandmarkToast,
      hideInfoToast
    }}>
      {children}
      <InfoToast
        message={message}
        isVisible={isVisible}
        onClose={hideInfoToast}
        timeout={timeout}
        position={position}
        perCursor={perCursor}
        dismissOnGraphInteraction={dismissOnGraphInteraction}
        showId={showId}
      />
    </InfoToastContext.Provider>
  );
};
