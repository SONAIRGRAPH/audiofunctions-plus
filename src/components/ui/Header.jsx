import React, { useCallback, useRef, useState } from "react";
import { SlidersHorizontal, Wand, Volume2, VolumeX } from "lucide-react";
import { useMixer } from "../../context/MixerContext";
import { ensureToneStarted } from "../../utils/toneAudio";
import { useCommandPaletteActions } from "./command-palette";
import MixerDebugPanel from "./MixerDebugPanel";

/** Temporary debug mixer: only in `npm run dev`, hidden from production builds. */
const SHOW_MIXER_DEBUG = import.meta.env.DEV;

/**
 * Header component for the application
 * Features command palette trigger and audio toggle
 */
const Header = () => {
  const { toggle } = useCommandPaletteActions();
  const { isAudioEnabled, toggleAudio } = useMixer();
  const [mixerDebugOpen, setMixerDebugOpen] = useState(false);
  const mixerButtonRef = useRef(null);

  const closeMixerDebug = useCallback(() => {
    setMixerDebugOpen(false);
    mixerButtonRef.current?.focus();
  }, []);

  const handleToggleAudio = async () => {
    await ensureToneStarted();
    toggleAudio();
  };

  // Detect operating system for keyboard shortcut display
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcutKey = isMac ? '⌘+K' : 'Ctrl+K';

  return (
    <header className="w-full py-2 px-4 flex justify-between border-b border-border shadow bg-background">
      <div className="flex items-center gap-4">
        <img src="/logo.svg" alt="AudioFunctions+ logo" className="size-17" />
        <h1 className="font-bold hidden sm:block">AudioFunctions+</h1>
      </div>

      <div className="flex items-center gap-4">
        {SHOW_MIXER_DEBUG ? (
          <button
            ref={mixerButtonRef}
            type="button"
            onClick={() => setMixerDebugOpen((open) => !open)}
            className="btn-secondary flex items-center gap-2"
            aria-expanded={mixerDebugOpen}
            aria-controls="mixer-debug-panel"
            title="Open debug mixer (temporary)"
          >
            <SlidersHorizontal className="size-5" />
            <span className="hidden sm:inline">Mixer</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleToggleAudio}
          className="p-2 hover:text-foreground border-transparent bg-transparent"
          aria-label={`${isAudioEnabled ? "Disable Audio" : "Enable Audio"}, keyboard shortcut: P`}
          title={`${isAudioEnabled ? "Disable Audio" : "Enable Audio"} (P)`}
        >
          {isAudioEnabled ? (
            <Volume2 className="size-7 text-primary" />
          ) : (
            <VolumeX className="size-7 text-danger" />
          )}
        </button>

        <button
          onClick={toggle}
          className="btn-primary flex items-center gap-2"
          aria-label={`Open Command Palette, keyboard shortcut: ${shortcutKey}`}
          title={`Open Command Palette (${shortcutKey})`}
        >
          <Wand className="size-5" />
          <span className="hidden sm:inline">Commands</span>
          <span className="text-xs opacity-70 hidden md:inline" aria-hidden="true">({shortcutKey})</span>
        </button>
      </div>
      {SHOW_MIXER_DEBUG && mixerDebugOpen ? (
        <MixerDebugPanel onClose={closeMixerDebug} />
      ) : null}
    </header>
  );
};

export default Header;
