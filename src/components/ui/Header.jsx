import React, { useLayoutEffect, useRef, useState } from "react";
import { Wand, Volume2, VolumeX } from "lucide-react";
import { useMixer } from "../../context/MixerContext";
import { ensureToneStarted } from "../../utils/toneAudio";
import { useCommandPaletteActions } from "./command-palette";

// Sizes in em of the header's font size; LOGO_EM matches size-[4.25em]
const LOGO_EM = 4.25;
const GAP_EM = 1;
// Below this the title would be little more than "A…", so it is hidden instead
const MIN_TITLE_EM = 5;

// Button detail levels: 0 = "Commands" + shortcut, 1 = "Commands", 2 = icons only
const ACTION_LEVELS = [0, 1, 2];

// What gives way when room runs out, in this order: the title is shortened
// first (CSS ellipsis), then hidden; only then do the buttons lose detail,
// and the logo goes last. The first step that fits is shown.
const STEPS = [
  { title: true, logo: true, actions: 0 },
  { title: false, logo: true, actions: 0 },
  { title: false, logo: true, actions: 1 },
  { title: false, logo: true, actions: 2 },
  { title: false, logo: false, actions: 2 },
];

/** Audio toggle and command palette button at one detail level. */
const HeaderActions = ({ level, measuring = false, isAudioEnabled, onToggleAudio, onOpenPalette, shortcutKey }) => {
  const audioLabel = isAudioEnabled ? "Disable Audio" : "Enable Audio";
  const AudioIcon = isAudioEnabled ? Volume2 : VolumeX;
  // The invisible measuring copies must not be focusable
  const tabIndex = measuring ? -1 : undefined;

  return (
    <div className="flex items-center gap-[1em] shrink-0">
      <button
        type="button"
        onClick={onToggleAudio}
        className="p-[0.5em] border-transparent bg-transparent"
        aria-label={`${audioLabel}, keyboard shortcut: P`}
        title={`${audioLabel} (P)`}
        tabIndex={tabIndex}
      >
        <AudioIcon className={`size-[1.75em] ${isAudioEnabled ? "text-primary" : "text-danger"}`} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onOpenPalette}
        className="btn-primary flex items-center gap-[0.5em] whitespace-nowrap"
        aria-label={`Open Command Palette, keyboard shortcut: ${shortcutKey}`}
        title={`Open Command Palette (${shortcutKey})`}
        tabIndex={tabIndex}
      >
        <Wand className="size-[1.25em] shrink-0" aria-hidden="true" />
        {level < 2 && <span>Commands</span>}
        {level === 0 && <span className="text-[0.75em] opacity-70" aria-hidden="true">({shortcutKey})</span>}
      </button>
    </div>
  );
};

/**
 * Header component for the application
 * Features command palette trigger and audio toggle
 *
 * Has to hold up to 400 % zoom with any font and text size. Whether
 * something fits is measured, not set by breakpoints: invisible copies of
 * the button levels sit in a zero-width box, and a ResizeObserver compares
 * the room in the header with what each step of STEPS needs (that also
 * catches web fonts loading). The title shrinks with an ellipsis on its own.
 *
 * All sizes are in em and the header's font size is capped at 2.2 % of the
 * window height, so zooming in cannot make it cover most of the page. The
 * 9px floor keeps short landscape screens readable.
 */
const Header = () => {
  const { toggle } = useCommandPaletteActions();
  const { isAudioEnabled, toggleAudio } = useMixer();
  const headerRef = useRef(null);
  const measureRef = useRef(null);
  const [step, setStep] = useState(STEPS[0]);

  const handleToggleAudio = async () => {
    await ensureToneStarted();
    toggleAudio();
  };

  // Detect operating system for keyboard shortcut display
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcutKey = isMac ? '⌘+K' : 'Ctrl+K';

  useLayoutEffect(() => {
    const header = headerRef.current;
    const rows = Array.from(measureRef.current.children);

    const update = () => {
      const style = getComputedStyle(header);
      const em = parseFloat(style.fontSize);
      const room = header.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const needs = (s) =>
        (s.logo ? (LOGO_EM + GAP_EM) * em : 0) +
        (s.title ? (MIN_TITLE_EM + GAP_EM) * em : 0) +
        rows[s.actions].offsetWidth;
      setStep(STEPS.find((s) => needs(s) <= room) ?? STEPS[STEPS.length - 1]);
    };

    update();
    const observer = new ResizeObserver(update);
    [header, ...rows].forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const actionProps = { isAudioEnabled, onToggleAudio: handleToggleAudio, onOpenPalette: toggle, shortcutKey };

  return (
    <header
      ref={headerRef}
      className="relative w-full flex items-center gap-[1em] py-[0.5em] px-[1em] text-[length:min(1rem,max(2.2vh,9px))] border-b border-border shadow bg-background"
    >
      <div className="flex flex-1 items-center gap-[1em] min-w-0">
        {step.logo && <img src="/logo.svg" alt="AudioFunctions+ logo" className="size-[4.25em] shrink-0" />}
        {/* Shortened with an ellipsis while it fits at all; hidden beyond
            that, but kept for screen readers so the page keeps its h1 */}
        <h1 className={`font-bold min-w-0 ${step.title ? "truncate" : "sr-only"}`}>AudioFunctions+</h1>
      </div>

      <HeaderActions level={step.actions} {...actionProps} />

      {/* Invisible copies of the button levels, only for measuring. Zero
          width, so they can never widen the page at high zoom. */}
      <div ref={measureRef} className="absolute top-0 left-0 w-0 h-0 overflow-hidden invisible pointer-events-none" aria-hidden="true">
        {ACTION_LEVELS.map((level) => (
          <div key={level} className="w-max">
            <HeaderActions level={level} measuring {...actionProps} />
          </div>
        ))}
      </div>
    </header>
  );
};

export default Header;
