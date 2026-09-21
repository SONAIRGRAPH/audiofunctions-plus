import React from "react";
import { Wand, Volume2, VolumeX } from "lucide-react";
import { useGraphContext } from "../../context/GraphContext";
import { useCommandPaletteActions } from "./command-palette";

/**
 * Header component for the application
 * Features command palette trigger and audio toggle
 */
const Header = () => {
  const { toggle } = useCommandPaletteActions();
  const { isAudioEnabled, setIsAudioEnabled, focusChart } = useGraphContext();

  const toggleAudio = () => {
    setIsAudioEnabled(prev => !prev);
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
        <button
          onClick={toggleAudio}
          className="p-2  hover:text-foreground border-transparent bg-transparent"
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
    </header>
  );
};

export default Header;
