import { useEffect } from "react";
import { useKBar, VisualState } from "kbar";
import { useDialog } from "./DialogContext";
import { useGraphContext } from "./GraphContext";
import { AUDIO_MODALITIES, useMixer } from "./MixerContext";

const CURSOR_NAVIGATION_KEYS = new Set([
  "arrowleft",
  "arrowright",
  "j",
  "l",
  "b",
  " ",
]);

// Keys that mean the user is exploring the chart (resume AUTO idle mute).
const CHART_ACTIVITY_KEYS = new Set([
  "arrowleft",
  "arrowright",
  "j",
  "l",
  "w",
  "a",
  "s",
  "d",
  "z",
  "x",
  "y",
  " ",
  "b",
  "home",
  "end",
  "r",
]);

const isChartFocused = () => {
  const active = document.activeElement;
  return Boolean(active && active.getAttribute("role") === "application");
};

const isChartPointerTarget = (event) => {
  const chart =
    document.getElementById("chart") || document.getElementById("jxgbox");
  return Boolean(chart && event.target instanceof Node && chart.contains(event.target));
};

const isCommandPaletteShortcut = (event) =>
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  event.key.toLowerCase() === "k";

const isPlainP = (event) =>
  event.key.toLowerCase() === "p" &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey;

const isChartActivityKey = (event) => {
  if (isPlainP(event) || isCommandPaletteShortcut(event)) return false;
  const key = event.key.toLowerCase();
  if (event.metaKey || event.ctrlKey) {
    // Landmark jump / center view / add landmark — still chart work.
    return ["arrowleft", "arrowright", "j", "l", "z", "b"].includes(key);
  }
  return CHART_ACTIVITY_KEYS.has(key);
};

const isCursorNavigationKey = (event) => {
  if (event.altKey) return false;
  const key = event.key.toLowerCase();
  // Ctrl/Cmd+B creates a landmark; it does not start batch playback.
  if (key === "b" && (event.ctrlKey || event.metaKey)) return false;
  return CURSOR_NAVIGATION_KEYS.has(key);
};

/**
 * Single owner of master mute/unmute.
 *
 * Combines:
 *   - command palette / dialog overlay mute (existing behaviour)
 *   - AUTO idle mute after AUDIO_IDLE_MUTE_MS (fade from AUDIO_IDLE_FADE_START_MS)
 *   - AUTO first-load enable when the user first moves the cursor (arrows, J/L, B, Space)
 *
 * Must render under MixerProvider, GraphContextProvider, DialogProvider, and KBarProvider.
 * Does not render UI.
 */
const SonificationMuteController = () => {
  const { visualState } = useKBar((state) => ({ visualState: state.visualState }));
  const { isDialogOpen } = useDialog();
  const { PlayFunction } = useGraphContext();
  const {
    audioModality,
    notifyActivity,
    tryEnableFromCursorNavigation,
    setOverlayMuted,
    setIdleHold,
  } = useMixer();

  const isCommandPaletteOpen = visualState !== VisualState.hidden;

  useEffect(() => {
    setOverlayMuted(isCommandPaletteOpen || isDialogOpen);
  }, [isCommandPaletteOpen, isDialogOpen, setOverlayMuted]);

  // Batch / held-arrow playback is intentional motion; do not idle-mute mid-run.
  useEffect(() => {
    setIdleHold(Boolean(PlayFunction?.active));
  }, [PlayFunction?.active, setIdleHold]);

  useEffect(() => {
    const onKeyDown = (event) => {
      // Only chart interaction lifts AUTO idle mute. Cmd/Ctrl+K (and other
      // chrome shortcuts) must not unmute for a frame before overlay mute.
      if (isChartFocused() && isChartActivityKey(event)) {
        notifyActivity();
      }

      if (audioModality !== AUDIO_MODALITIES.AUTO) return;
      if (!isCursorNavigationKey(event)) return;
      if (!isChartFocused()) return;

      tryEnableFromCursorNavigation();
    };

    const onPointerActivity = (event) => {
      if (isChartPointerTarget(event)) {
        notifyActivity();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerActivity);
    document.addEventListener("pointermove", onPointerActivity);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerActivity);
      document.removeEventListener("pointermove", onPointerActivity);
    };
  }, [audioModality, notifyActivity, tryEnableFromCursorNavigation]);

  return null;
};

export default SonificationMuteController;
