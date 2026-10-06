import { useEffect, useRef } from "react";
import { useGraphContext } from "../../context/GraphContext";
import { getActiveFunctions } from "../../utils/graphObjectOperations";
import audioSampleManager from "../../utils/audioSamples";
import { ensureToneStarted } from "../../utils/toneAudio";
import { cancelBoundsAnnouncement } from "../../utils/boundsAnnouncement";
import { useCommandPaletteActions } from "./command-palette";
import { matchesShortcut } from "./matchesShortcut";
import { HOTKEYS, bindableCombos } from "./hotkeys";
import { useCommands, useZoomBoard } from "./useCommands";

/** Elements that swallow single-letter shortcuts because the user is typing into them. */
function isTypingTarget(element) {
    if (!element) return false;
    if (element.isContentEditable) return true;
    return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
}

/**
 * Where the keypress applies:
 *
 *   'chart'  the chart has focus -- everything is allowed
 *   'global' somewhere else on the page -- only `scope: 'global'` commands
 *   null     a text field, an open dialog or the open palette owns the keyboard
 *
 * Two selectors: the palette is a native `<dialog>`, the other dialogs come from
 * Headless UI and render `div[role="dialog"]`. Both are in the DOM only while open.
 */
function currentScope() {
    if (document.querySelector('dialog[open], [role="dialog"]')) return null;

    const active = document.activeElement;
    if (active?.getAttribute("role") === "application") return "chart";
    if (isTypingTarget(active)) return null;
    return "global";
}

const allowsScope = (required, scope) => (required === "chart" ? scope === "chart" : scope !== null);

/** Every item of the palette tree, parents included. */
function flattenItems(items, out = []) {
    for (const item of items) {
        out.push(item);
        if (Array.isArray(item.children)) flattenItems(item.children, out);
    }
    return out;
}

/**
 * Warns about assignments that cannot work -- a key in the table without an action, or
 * one combination claimed twice. Development only; in production the first match wins.
 */
function warnAboutConflicts(actions, items) {
    const seen = new Map();
    const claim = (combo, owner) => {
        const signature = combo.join("+").toLowerCase();
        const previous = seen.get(signature);
        if (previous) console.warn(`Hotkey ${signature} is claimed by both "${previous}" and "${owner}"`);
        else seen.set(signature, owner);
    };

    for (const [id, entry] of Object.entries(HOTKEYS)) {
        if (!actions[id]) console.warn(`Hotkey "${id}" has no action in useCommands`);
        entry.combos.forEach((combo) => claim(combo, id));
    }

    for (const item of flattenItems(items)) {
        if (!item.shortcut || HOTKEYS[item.id]) continue;
        claim(item.shortcut, item.id);
    }
}

/**
 * Turns key presses into commands.
 *
 * Two sources, in this order:
 *
 *  1. `hotkeys.js` -- the assignment table, paired by id with `useCommands`.
 *  2. Palette items carrying a `shortcut` of their own, bound globally. This covers the
 *     entries whose key depends on the graph: landmarks and the function digits.
 *
 * @param {object} props
 * @param {Array} props.items the palette item tree from `usePaletteItems`
 */
export default function KeyboardHandler({ items }) {
    const {
        setPlayFunction,
        cursorCoords,
        updateCursor,
        stepSize,
        functionDefinitions,
        setExplorationMode,
        PlayFunction,
        mouseTimeoutRef,
        setIsShiftPressed,
    } = useGraphContext();

    const commands = useCommands();
    const zoomBoard = useZoomBoard();
    const palette = useCommandPaletteActions();

    const pressedKeys = useRef(new Set());
    const lastKeyDownTime = useRef(null);
    const HOLD_THRESHOLD = 1000;
    const KEYPRESS_THRESHOLD = 15;

    /**
     * Cursor movement. Holding the key repeats the step, Shift turns it into a
     * continuous glide that `handleKeyUp` stops again.
     */
    const moveCursor = async (direction, event) => {
        // If batch sonification is active, stop it and keep cursor at current position
        if (PlayFunction.active && (PlayFunction.source === "play" || PlayFunction.source === "play_space")) {
            setPlayFunction(prev => ({ ...prev, active: false }));
            setExplorationMode("none");
            return;
        }

        // First, stop any active smooth movement
        if (PlayFunction.active && PlayFunction.source === "keyboard") {
            setPlayFunction(prev => ({ ...prev, active: false }));
        }

        // Clear any mouse exploration timeout
        if (mouseTimeoutRef.current) {
            clearTimeout(mouseTimeoutRef.current);
            mouseTimeoutRef.current = null;
        }

        if (event.shiftKey) {
            setExplorationMode("keyboard_smooth");
            setPlayFunction(prev => ({ ...prev, source: "keyboard", active: true, direction }));   // smooth move
            return;
        }

        setExplorationMode("keyboard_stepwise");
        const CurrentX = parseFloat(cursorCoords[0].x);
        // Use a more robust approach to check if we're on the grid
        // This handles floating-point precision issues
        const epsilon = 1e-10; // Small tolerance for floating-point comparison
        const gridPosition = Math.round(CurrentX / stepSize) * stepSize;
        const IsOnGrid = Math.abs(CurrentX - gridPosition) < epsilon;
        const NewX = direction === 1
            ? (IsOnGrid ? CurrentX + stepSize : Math.ceil(CurrentX / stepSize) * stepSize)
            : (IsOnGrid ? CurrentX - stepSize : Math.floor(CurrentX / stepSize) * stepSize);

        const currentTime = Date.now();

        // Only move on the first keydown, or once the hold threshold has passed
        if (lastKeyDownTime.current && (currentTime - lastKeyDownTime.current) < HOLD_THRESHOLD) return;

        // Check for points of interest between the old and the new position
        const pointsOfInterest = [];
        getActiveFunctions(functionDefinitions).forEach(func => {
            func.pointOfInterests.forEach((point) => {
                pointsOfInterest.push(point.x);
            });
        });
        const passed = direction === 1
            ? pointsOfInterest.filter(e => (CurrentX < e) && (e < NewX))
            : pointsOfInterest.filter(e => (NewX < e) && (e < CurrentX));

        // No mute check here: the mixer silences its bus when audio is off.
        if (passed.length > 0) {
            try {
                await audioSampleManager.playSample("notification", { volume: -15 });
            } catch (error) {
                console.warn("Failed to play notification sound:", error);
            }
        }

        // Move cursor and update last keydown time
        updateCursor(NewX);
        lastKeyDownTime.current = currentTime;
    };

    // The registry, plus the commands that need keyboard state: zoom reads a held X or
    // Y key, Q opens the palette inside a submenu, the cursor keys move the cursor.
    const actions = {
        ...commands,
        "zoom-in": () => zoomBoard(false, pressedKeys.current.has("x"), pressedKeys.current.has("y")),
        "zoom-out": () => zoomBoard(true, pressedKeys.current.has("x"), pressedKeys.current.has("y")),
        "quick-options": () => palette.open(["quick-options"]),
        "cursor-left": (event) => moveCursor(-1, event),
        "cursor-right": (event) => moveCursor(1, event),
    };

    // The listeners below are registered once and read the current actions from here,
    // rather than closing over them.
    const latest = useRef(null);
    latest.current = { actions, items };

    useEffect(() => {
        if (import.meta.env.DEV) warnAboutConflicts(latest.current.actions, latest.current.items);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            // Any key is activity: drop a pending bounds announcement. A pan or zoom
            // triggered by this very key schedules a fresh one.
            cancelBoundsAnnouncement();

            // Respect a handler that already claimed this combination.
            if (event.defaultPrevented) return;

            if (event.key === "Shift") setIsShiftPressed(true);

            const scope = currentScope();
            if (scope === null) return;

            // A keydown is a user gesture, so the browser lets the audio context start
            // here. Not awaited: preventDefault() below has to run synchronously.
            ensureToneStarted().catch((error) => console.warn("Could not start audio:", error));

            pressedKeys.current.add(event.key.toLowerCase());

            const { actions, items } = latest.current;

            const run = (action, argument) => {
                event.preventDefault();
                event.stopPropagation();
                action(argument);
            };

            // 1. The assignment table.
            for (const [id, entry] of Object.entries(HOTKEYS)) {
                if (!allowsScope(entry.scope, scope)) continue;
                if (!bindableCombos(entry).some((combo) => matchesShortcut(event, combo))) continue;
                if (actions[id]) run(actions[id], event);
                return;
            }

            // 2. Palette entries carrying their own shortcut -- landmarks, functions.
            for (const item of flattenItems(items)) {
                if (!item.shortcut || !item.perform || HOTKEYS[item.id]) continue;
                const combos = bindableCombos({ combos: [item.shortcut], shiftModifies: item.shiftModifies });
                if (!combos.some((combo) => matchesShortcut(event, combo))) continue;
                run(item.perform, item);
                return;
            }
        };

        const handleKeyUp = (event) => {
            if (event.key === "Shift") setIsShiftPressed(false);

            pressedKeys.current.delete(event.key.toLowerCase());

            if (currentScope() === null) return;

            // Releasing a cursor key stops the glide but keeps the last cursor position.
            const isCursorKey = ["cursor-left", "cursor-right"].some((id) =>
                bindableCombos(HOTKEYS[id]).some((combo) => matchesShortcut(event, combo)));
            if (!isCursorKey) return;

            setPlayFunction(prev => (prev.source === "keyboard" ? { ...prev, active: false } : prev));
            // Reset exploration mode when keyboard exploration stops
            setExplorationMode("none");

            if (Date.now() - (lastKeyDownTime.current || 0) > KEYPRESS_THRESHOLD) {
                lastKeyDownTime.current = null;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
        };
    }, [setIsShiftPressed, setPlayFunction, setExplorationMode]);

    return null;
}
