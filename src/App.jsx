import './App.css';
import { KBarProvider, useKBar } from 'kbar';
import CommandBar from './components/ui/CommandPalette';
import GraphView from './components/graph/GraphView';
import React, { useEffect, useRef } from "react";
import { GraphContextProvider } from "./context/GraphContext";
import { useGraphContext } from './context/GraphContext';
import GraphSonification from './components/graph/GraphSonification';
import { DialogProvider, useDialog } from './context/DialogContext';
import Header from './components/ui/Header';
import { InstrumentsProvider } from './context/InstrumentsContext';
import KeyboardHandler from "./components/ui/KeyboardHandler";
import { PaletteActions } from './components/ui/PaletteActions_dyn';
import { AnnouncementProvider } from './context/AnnouncementContext';
import { InfoToastProvider } from './context/InfoToastContext';

function App() {
  return (
    <InstrumentsProvider>
      <GraphContextProvider>
        <AnnouncementProvider>
          <InfoToastProvider>
            <DialogProvider>
              <KeyboardHandler />
              <AppContent />
            </DialogProvider>
          </InfoToastProvider>
        </AnnouncementProvider>
      </GraphContextProvider>
    </InstrumentsProvider>
  );
}

const AppContent = () => {
  const { openDialog } = useDialog();
  const hasCheckedWelcome = useRef(false);

  // Check if this is the first visit and show welcome dialog
  useEffect(() => {
    // Prevent double execution
    if (hasCheckedWelcome.current) return;
    hasCheckedWelcome.current = true;

    let hasSeenWelcome = false;
    try {
      hasSeenWelcome = localStorage.getItem('audiofunctions-welcome-seen');
    } catch (error) {
      console.warn('localStorage not available:', error);
      // If localStorage is disabled, assume first visit
      hasSeenWelcome = false;
    }
    if (!hasSeenWelcome) {
      // Small delay to ensure everything is loaded
      setTimeout(() => {
        openDialog('welcome', { isAutoOpened: true });
      }, 1000);
    }
  }, [openDialog]);

  return <KBarWrapper />;
};

const KBarWrapper = () => {
  // needed to wrap actions into GraphContextProvider
  const { setIsAudioEnabled, focusChart } = useGraphContext();

  const handleSkipActivate = (e) => {
    // Enable audio and focus the chart just like pressing "P"
    if (e) e.preventDefault();
    setIsAudioEnabled((prev) => (prev ? prev : true));
    // Ensure focus after enabling audio
    setTimeout(() => {
      // Update hash to keep expected behavior of the skip link
      if (window.location.hash !== '#chart') {
        window.location.hash = 'chart';
      }
      focusChart();
    }, 0);
  };

  return (
    <KBarProvider>
      {/* Skip link for accessibility */}
      <a
        href="#chart"
        className="skip-link"
        style={{
          position: 'absolute',
          top: '-40px',
          left: '6px',
          background: 'var(--color-primary)',
          color: 'var(--color-txt-title)',
          padding: '8px 16px',
          textDecoration: 'none',
          borderRadius: '4px',
          zIndex: 1000,
          transition: 'top 0.3s ease'
        }}
        onFocus={(e) => {
          e.target.style.top = '6px';
        }}
        onBlur={(e) => {
          e.target.style.top = '-40px';
        }}
        onClick={handleSkipActivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleSkipActivate(e);
          }
        }}
      >
        Skip to chart. Enable audio chart keyboard interaction.
      </a>

      <PaletteActions />
      <CommandBar />
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw" }}>
        <Header />
        <div className="flex-1 overflow-auto">
          <GraphView />
          <GraphSonification />
        </div>
      </div>
    </KBarProvider>
  );
};

// OpenCommandBarButton removed as its functionality is now in the Header

export default App;
